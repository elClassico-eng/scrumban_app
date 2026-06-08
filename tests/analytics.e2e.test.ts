// End-to-end tests for /analytics/throughput and /analytics/cycle-time.
// Counts and ordering are deterministic; the cycle-time *value* is
// nondeterministic (depends on test wall-clock), so we assert it's
// non-negative and that the min-sample threshold for percentiles fires.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

interface UserCtx {
  email: string
  jar: CookieJar
  id: string
}

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string; email: string } }>(
    jar,
    '/api/auth/register',
    {
      method: 'POST',
      body: {
        email,
        password: 'correct horse battery 1',
        workspace: { name: 'Reg WS', slug: 'reg-ws' },
      },
      headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
    },
  )
  return { email, jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx, slug = 'acme'): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(
    actor.jar,
    '/api/workspaces',
    { method: 'POST', body: { name: slug.toUpperCase(), slug } },
  )
  return res.body.workspace.id
}

interface BoardCtx {
  boardId: string
  columns: Record<'backlog' | 'in_progress' | 'review' | 'done', string>
}

async function createBoardWithColumns(actor: UserCtx, wsId: string): Promise<BoardCtx> {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: 'Main', slug: 'main' } },
  )
  const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${board.body.board.id}/columns`,
  )
  const lookup = Object.fromEntries(cols.body.columns.map((c) => [c.columnRole, c.id])) as Record<
    'backlog' | 'in_progress' | 'review' | 'done',
    string
  >
  return { boardId: board.body.board.id, columns: lookup }
}

async function createAndCloseTask(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  columns: BoardCtx['columns'],
  title: string,
): Promise<string> {
  const create = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId: columns.backlog, title } },
  )
  await fetchWithJar(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks/${create.body.task.id}/move`,
    { method: 'POST', body: { toColumnId: columns.done, toPosition: 0 } },
  )
  return create.body.task.id
}

describe('GET /analytics/throughput', () => {
  it('counts task_closed events bucketed by day', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await createAndCloseTask(owner, wsId, boardId, columns, 't1')
    await createAndCloseTask(owner, wsId, boardId, columns, 't2')
    await createAndCloseTask(owner, wsId, boardId, columns, 't3')

    const res = await fetchWithJar<{
      buckets: { bucket: string; count: number }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/throughput`)
    expect(res.status).toBe(200)
    // All three closed today → exactly one bucket with count=3.
    expect(res.body.buckets).toHaveLength(1)
    expect(res.body.buckets[0]!.count).toBe(3)
  })

  it('returns an empty bucket list when no tasks have been closed', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar<{ buckets: unknown[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/analytics/throughput`,
    )
    expect(res.status).toBe(200)
    expect(res.body.buckets).toHaveLength(0)
  })

  it('rejects unknown period values (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/analytics/throughput?period=year`,
    )
    expect(res.status).toBe(400)
  })

  it('non-member gets 404 (no leak)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar(
      stranger.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/analytics/throughput`,
    )
    expect(res.status).toBe(404)
  })
})

describe('GET /analytics/cycle-time', () => {
  it('returns per-task cycle hours and stats with min-sample guard', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await createAndCloseTask(owner, wsId, boardId, columns, 't1')

    const res = await fetchWithJar<{
      samples: { taskId: string; cycleHours: number }[]
      stats: {
        count: number
        meanHours: number | null
        p50Hours: number | null
        p85Hours: number | null
        p95Hours: number | null
      }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/cycle-time`)

    expect(res.status).toBe(200)
    expect(res.body.samples).toHaveLength(1)
    expect(res.body.samples[0]!.cycleHours).toBeGreaterThanOrEqual(0)
    expect(res.body.stats.count).toBe(1)
    // 1 sample is below the min-data threshold → percentiles must be null.
    expect(res.body.stats.p50Hours).toBeNull()
    expect(res.body.stats.p85Hours).toBeNull()
    expect(res.body.stats.p95Hours).toBeNull()
    // Mean is well-defined for any non-empty set.
    expect(res.body.stats.meanHours).not.toBeNull()
  })

  it('percentiles populate once at least 5 samples are in window', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    for (let i = 0; i < 5; i++) {
      await createAndCloseTask(owner, wsId, boardId, columns, `t${i}`)
    }

    const res = await fetchWithJar<{
      stats: {
        count: number
        p50Hours: number | null
        p85Hours: number | null
        p95Hours: number | null
      }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/cycle-time`)
    expect(res.body.stats.count).toBe(5)
    expect(res.body.stats.p50Hours).not.toBeNull()
    expect(res.body.stats.p85Hours).not.toBeNull()
    expect(res.body.stats.p95Hours).not.toBeNull()
  })

  it('returns empty samples and null stats with no closed tasks', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar<{
      samples: unknown[]
      stats: { count: number; meanHours: number | null }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/cycle-time`)
    expect(res.body.samples).toHaveLength(0)
    expect(res.body.stats.count).toBe(0)
    expect(res.body.stats.meanHours).toBeNull()
  })
})
