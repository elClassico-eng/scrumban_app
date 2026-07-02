import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
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

type UserCtx = { email: string, jar: CookieJar, id: string }

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string, email: string } }>(
    jar,
    '/api/auth/register',
    {
      method: 'POST',
      body: {
        email,
        password: 'correct horse battery 1',
        workspace: { name: 'Reg WS', slug: 'reg-ws' },
      },
      headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

type BoardCtx = {
  boardId: string
  columns: Record<'backlog' | 'in_progress' | 'review' | 'done', string>
}

async function createBoardWithColumns(actor: UserCtx, wsId: string): Promise<BoardCtx> {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: 'Main', slug: 'main' } },
  )
  const cols = await fetchWithJar<{ columns: { id: string, columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${board.body.board.id}/columns`,
  )
  const lookup = Object.fromEntries(cols.body.columns.map(c => [c.columnRole, c.id])) as Record<
    'backlog' | 'in_progress' | 'review' | 'done',
    string
  >
  return { boardId: board.body.board.id, columns: lookup }
}

async function createTask(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  columnId: string,
  title: string,
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title } },
  )
  return res.body.task.id
}

async function closeTask(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  taskId: string,
  doneColumnId: string,
): Promise<void> {
  await fetchWithJar(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`,
    { method: 'POST', body: { toColumnId: doneColumnId, toPosition: 0 } },
  )
}

async function seedHistory(actor: UserCtx, wsId: string, ctx: BoardCtx, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const id = await createTask(actor, wsId, ctx.boardId, ctx.columns.backlog, `history-${i}`)
    await closeTask(actor, wsId, ctx.boardId, id, ctx.columns.done)
  }
}

async function createSprintWithTasks(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  taskIds: string[],
): Promise<string> {
  const sprint = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    {
      method: 'POST',
      body: {
        name: 'Sprint J',
        plannedStartAt: new Date().toISOString(),
        plannedEndAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    },
  )
  for (const taskId of taskIds) {
    await fetchWithJar(
      actor.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprint.body.sprint.id}/tasks`,
      { method: 'POST', body: { taskId } },
    )
  }
  return sprint.body.sprint.id
}

async function snapshotRows(sprintId: string): Promise<{ trigger: string, payload: Record<string, unknown> }[]> {
  const sql = getTestSql()
  return sql`
    SELECT trigger, payload FROM forecast_snapshots
    WHERE sprint_id = ${sprintId}
    ORDER BY taken_at ASC
  ` as unknown as Promise<{ trigger: string, payload: Record<string, unknown> }[]>
}

describe('forecast snapshots anchors', () => {
  it('sprint start creates a sprint_start snapshot when history is sufficient', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1])

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/start`,
      { method: 'POST' },
    )
    expect(res.status).toBe(200)

    const rows = await snapshotRows(sprintId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.trigger).toBe('sprint_start')
    const payload = rows[0]!.payload as { simulation: { p85Days: number }, committedSp: number }
    expect(payload.simulation.p85Days).toBeGreaterThan(0)
    expect(payload.committedSp).toBe(0)
  })

  it('sprint start with insufficient history still succeeds and writes no snapshot', async () => {
    const owner = await registerUser('owner2@example.com')
    const wsId = await createWorkspace(owner, 'acme2')
    const ctx = await createBoardWithColumns(owner, wsId)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1])

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/start`,
      { method: 'POST' },
    )
    expect(res.status).toBe(200)
    expect(await snapshotRows(sprintId)).toHaveLength(0)
  })

  it('sprint close creates a sprint_close snapshot with resolution block', async () => {
    const owner = await registerUser('owner3@example.com')
    const wsId = await createWorkspace(owner, 'acme3')
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const t2 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-2')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1, t2])

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/start`,
      { method: 'POST' },
    )
    await closeTask(owner, wsId, ctx.boardId, t1, ctx.columns.done)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/close`,
      { method: 'POST' },
    )
    expect(res.status).toBe(200)

    const rows = await snapshotRows(sprintId)
    expect(rows.map(r => r.trigger)).toEqual(['sprint_start', 'sprint_close'])
    const payload = rows[1]!.payload as { resolution?: { totalCount: number, doneCount: number } }
    expect(payload.resolution).toBeDefined()
    expect(payload.resolution!.totalCount).toBe(2)
    expect(payload.resolution!.doneCount).toBe(1)
  })
})

describe('forecast journal endpoints', () => {
  it('forecast-history returns snapshots ordered by takenAt', async () => {
    const owner = await registerUser('owner4@example.com')
    const wsId = await createWorkspace(owner, 'acme4')
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1])
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/start`, { method: 'POST' })

    const res = await fetchWithJar<{ snapshots: { trigger: string, payload: { simulation: { p85Days: number } } }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/forecast-history`,
    )
    expect(res.status).toBe(200)
    expect(res.body.snapshots).toHaveLength(1)
    expect(res.body.snapshots[0]!.trigger).toBe('sprint_start')
  })

  it('forecast-accuracy reports calibration over closed sprints with anchors', async () => {
    const owner = await registerUser('owner5@example.com')
    const wsId = await createWorkspace(owner, 'acme5')
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1])
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/start`, { method: 'POST' })
    await closeTask(owner, wsId, ctx.boardId, t1, ctx.columns.done)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/close`, { method: 'POST' })

    const res = await fetchWithJar<{ report: { total: number, p85HitCount: number, rows: { sprintId: string, actualDays: number, p85Hit: boolean }[] } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/analytics/forecast-accuracy`,
    )
    expect(res.status).toBe(200)
    expect(res.body.report.total).toBe(1)
    expect(res.body.report.rows[0]!.sprintId).toBe(sprintId)
    expect(res.body.report.rows[0]!.p85Hit).toBe(true)
    expect(res.body.report.p85HitCount).toBe(1)
  })

  it('sprint closed without start anchor is excluded from accuracy', async () => {
    const owner = await registerUser('owner6@example.com')
    const wsId = await createWorkspace(owner, 'acme6')
    const ctx = await createBoardWithColumns(owner, wsId)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1])
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/start`, { method: 'POST' })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/close`, { method: 'POST' })

    const res = await fetchWithJar<{ report: { total: number } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/analytics/forecast-accuracy`,
    )
    expect(res.status).toBe(200)
    expect(res.body.report.total).toBe(0)
  })
})

async function runDailyTask(actor: UserCtx): Promise<void> {
  const res = await fetchWithJar<{ result: { result: string } }>(
    actor.jar,
    `/api/_dev/tasks/${encodeURIComponent('forecast:daily-snapshots')}/run`,
    { method: 'POST', body: {} },
  )
  expect(res.status).toBe(200)
  expect(res.body.result.result).toBe('success')
}

describe('forecast daily snapshots task', () => {
  it('takes a daily snapshot for an active sprint and dedupes the second run', async () => {
    const owner = await registerUser('owner7@example.com')
    const wsId = await createWorkspace(owner, 'acme7')
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1])
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprintId}/start`, { method: 'POST' })

    await runDailyTask(owner)
    let rows = await snapshotRows(sprintId)
    expect(rows.map(r => r.trigger)).toEqual(['sprint_start', 'daily'])

    await runDailyTask(owner)
    rows = await snapshotRows(sprintId)
    expect(rows.filter(r => r.trigger === 'daily')).toHaveLength(1)
  })

  it('ignores planned sprints', async () => {
    const owner = await registerUser('owner8@example.com')
    const wsId = await createWorkspace(owner, 'acme8')
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'task-1')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [t1])

    await runDailyTask(owner)
    expect(await snapshotRows(sprintId)).toHaveLength(0)
  })
})
