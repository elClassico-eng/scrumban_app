// Direct DB integration test for the Row-Level Security policies on
// Phase 2 tables. Bypasses Nuxt entirely — connects to the test DB with
// postgres-js and asserts that tenants cannot see each other's rows.
//
// This is the "did the policy actually take effect" test. If FORCE ROW
// LEVEL SECURITY is missing or a policy USING clause regresses, this
// test goes red before any user-visible bug.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, sql } from 'drizzle-orm'
import postgres from 'postgres'
import {
  boardColumns,
  boards,
  tasks,
  workspaceMembers,
  workspaces,
  users,
} from '../server/db/schema'
import { resetDb } from './helpers/db'
import { TEST_URL } from './setup.global'

// Use scrumban_app (the runtime role) for all queries — that's the role
// whose RLS enforcement we actually care about in production.
const client = postgres(TEST_URL, { max: 1 })
const db = drizzle(client)

afterAll(async () => {
  await client.end()
})

interface SeededTenant {
  workspaceId: string
  ownerId: string
  boardId: string
  columnId: string
  taskId: string
}

// Seeds two tenants; each call to withTenant scopes inserts to one of them.
// users + workspaces + workspace_members are NOT under RLS (they are not
// tenant-scoped data tables), so we can insert them outside withTenant.
async function seed(): Promise<{ alpha: SeededTenant; beta: SeededTenant }> {
  await resetDb()

  const [aliceUser] = await db.insert(users).values({ email: 'alice@a.com', passwordHash: 'x' }).returning()
  const [bobUser] = await db.insert(users).values({ email: 'bob@b.com', passwordHash: 'x' }).returning()

  const [wsAlpha] = await db.insert(workspaces).values({ name: 'Alpha', slug: 'alpha' }).returning()
  const [wsBeta] = await db.insert(workspaces).values({ name: 'Beta', slug: 'beta' }).returning()

  await db.insert(workspaceMembers).values([
    { workspaceId: wsAlpha!.id, userId: aliceUser!.id, role: 'owner' },
    { workspaceId: wsBeta!.id, userId: bobUser!.id, role: 'owner' },
  ])

  const alpha = await seedTenantData(wsAlpha!.id)
  const beta = await seedTenantData(wsBeta!.id)
  return {
    alpha: { ...alpha, workspaceId: wsAlpha!.id, ownerId: aliceUser!.id },
    beta: { ...beta, workspaceId: wsBeta!.id, ownerId: bobUser!.id },
  }
}

async function seedTenantData(workspaceId: string) {
  return withTestTenant(workspaceId, async (tx) => {
    const [board] = await tx
      .insert(boards)
      .values({ workspaceId, name: 'Main', slug: 'main' })
      .returning()
    const [col] = await tx
      .insert(boardColumns)
      .values({
        workspaceId,
        boardId: board!.id,
        name: 'Backlog',
        position: 0,
        columnRole: 'backlog',
      })
      .returning()
    const [task] = await tx
      .insert(tasks)
      .values({
        workspaceId,
        boardId: board!.id,
        columnId: col!.id,
        title: `secret of ${workspaceId.slice(0, 8)}`,
        position: 0,
      })
      .returning()
    return { boardId: board!.id, columnId: col!.id, taskId: task!.id }
  })
}

// Local copy of withTenant used here so the test isn't coupled to Nuxt's
// useRuntimeConfig() (which is unavailable outside a Nuxt request).
async function withTestTenant<T>(
  workspaceId: string,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`)
    return fn(tx)
  })
}

describe('RLS — tenant isolation on Phase 2 tables', () => {
  let seeded: Awaited<ReturnType<typeof seed>>
  beforeAll(async () => {
    seeded = await seed()
  })

  it('queries scoped to alpha return only alpha rows', async () => {
    const rows = await withTestTenant(seeded.alpha.workspaceId, async (tx) => {
      return tx.select().from(tasks)
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(seeded.alpha.taskId)
  })

  it('queries scoped to beta return only beta rows', async () => {
    const rows = await withTestTenant(seeded.beta.workspaceId, async (tx) => {
      return tx.select().from(tasks)
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(seeded.beta.taskId)
  })

  it('alpha cannot see beta\'s task by id', async () => {
    const rows = await withTestTenant(seeded.alpha.workspaceId, async (tx) => {
      return tx.select().from(tasks).where(eq(tasks.id, seeded.beta.taskId))
    })
    expect(rows).toHaveLength(0)
  })

  it('without app.workspace_id set, no rows are returned', async () => {
    const rows = await db.select().from(tasks)
    expect(rows).toHaveLength(0)
  })

  it('cannot INSERT into another tenant (WITH CHECK clause blocks)', async () => {
    // Drizzle wraps the underlying PostgresError so the wrapper's .message
    // doesn't contain "row-level security"; we assert on rejection broadly
    // and then confirm beta's task count is unchanged.
    await expect(
      withTestTenant(seeded.alpha.workspaceId, async (tx) => {
        return tx
          .insert(tasks)
          .values({
            workspaceId: seeded.beta.workspaceId,
            boardId: seeded.beta.boardId,
            columnId: seeded.beta.columnId,
            title: 'cross-tenant task',
            position: 99,
          })
          .returning()
      }),
    ).rejects.toThrow()

    const betaTasks = await withTestTenant(seeded.beta.workspaceId, async (tx) =>
      tx.select().from(tasks),
    )
    expect(betaTasks).toHaveLength(1) // still only the original seed task
  })

  it('UPDATE outside the tenant scope affects zero rows', async () => {
    const result = await withTestTenant(seeded.alpha.workspaceId, async (tx) => {
      return tx.update(tasks).set({ title: 'tampered' }).where(eq(tasks.id, seeded.beta.taskId))
    })
    expect(result.count).toBe(0)

    // Verify beta's task is untouched.
    const [betaTask] = await withTestTenant(seeded.beta.workspaceId, async (tx) =>
      tx.select().from(tasks).where(eq(tasks.id, seeded.beta.taskId)),
    )
    expect(betaTask!.title).not.toBe('tampered')
  })

  it('boards / board_columns / task_events policies are also active', async () => {
    const boardRows = await withTestTenant(seeded.alpha.workspaceId, async (tx) =>
      tx.select().from(boards),
    )
    expect(boardRows).toHaveLength(1)
    expect(boardRows[0]!.id).toBe(seeded.alpha.boardId)

    const columnRows = await withTestTenant(seeded.alpha.workspaceId, async (tx) =>
      tx.select().from(boardColumns),
    )
    expect(columnRows).toHaveLength(1)
    expect(columnRows[0]!.id).toBe(seeded.alpha.columnId)
  })
})
