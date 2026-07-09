import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { SprintNetworkReport } from '../server/services/network-forecast.service'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

type UserCtx = {
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
  const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
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

async function seedHistory(
  actor: UserCtx,
  wsId: string,
  ctx: BoardCtx,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const id = await createTask(actor, wsId, ctx.boardId, ctx.columns.backlog, `history-${i}`)
    await closeTask(actor, wsId, ctx.boardId, id, ctx.columns.done)
  }
}

async function addDependency(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  blockedTaskId: string,
  blockerTaskId: string,
): Promise<void> {
  await fetchWithJar(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks/${blockedTaskId}/dependencies`,
    { method: 'POST', body: { blockerTaskId } },
  )
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
        name: 'Sprint 1',
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

function networkPath(wsId: string, boardId: string, sprintId: string): string {
  return `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprintId}/network`
}

describe('GET /sprints/:sprintId/network', () => {
  it('returns insufficient_data with fewer than 5 closed tasks', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 4)
    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [a])

    const res = await fetchWithJar<SprintNetworkReport>(
      owner.jar,
      networkPath(wsId, ctx.boardId, sprintId),
    )
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    if (!res.body.ok) {
      expect(res.body.reason).toBe('insufficient_data')
      expect(res.body.closedSamples).toBe(4)
      expect(res.body.requiredSamples).toBe(5)
    }
  })

  it('computes critical path and slack on the chain A->B->D with parallel C->D', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)

    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A')
    const b = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'B')
    const c = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'C')
    const d = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'D')
    await addDependency(owner, wsId, ctx.boardId, b, a)
    await addDependency(owner, wsId, ctx.boardId, d, b)
    await addDependency(owner, wsId, ctx.boardId, d, c)
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [a, b, c, d])

    const res = await fetchWithJar<SprintNetworkReport>(
      owner.jar,
      networkPath(wsId, ctx.boardId, sprintId),
    )
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      expect(res.body.remainingCount).toBe(4)
      expect(res.body.edgeCount).toBe(3)
      expect(res.body.criticalPathIds).toEqual([a, b, d])
      const taskC = res.body.tasks.find(t => t.taskId === c)!
      expect(taskC.critical).toBe(false)
      expect(taskC.slackDays).toBeGreaterThan(0)
      expect(res.body.pert.probabilityWithinHorizon).toBe(1)
      expect(res.body.simulation.p50Days).toBeLessThanOrEqual(res.body.simulation.p85Days)
      expect(res.body.simulation.p85Days).toBeLessThanOrEqual(res.body.simulation.p95Days)
      expect(res.body.naive).not.toBeNull()
    }
  })

  it('excludes closed sprint tasks and their edges from the network', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)

    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A')
    const b = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'B')
    const c = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'C')
    const d = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'D')
    await addDependency(owner, wsId, ctx.boardId, b, a)
    await addDependency(owner, wsId, ctx.boardId, d, b)
    await addDependency(owner, wsId, ctx.boardId, d, c)
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [a, b, c, d])
    await closeTask(owner, wsId, ctx.boardId, b, ctx.columns.done)

    const res = await fetchWithJar<SprintNetworkReport>(
      owner.jar,
      networkPath(wsId, ctx.boardId, sprintId),
    )
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      expect(res.body.remainingCount).toBe(3)
      expect(res.body.closedCount).toBe(1)
      expect(res.body.edgeCount).toBe(1)
    }
  })

  it('manual estimate overrides history and reports manual source', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [a])

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${a}`,
      { method: 'PATCH', body: { estimateDays: 10 } },
    )

    const res = await fetchWithJar<SprintNetworkReport>(
      owner.jar,
      networkPath(wsId, ctx.boardId, sprintId),
    )
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      const view = res.body.tasks.find(t => t.taskId === a)!
      expect(view.estimateSource.kind).toBe('manual')
      expect(view.estimate.mostLikelyDays).toBe(10)
      expect(view.estimate.pessimisticDays).toBeGreaterThanOrEqual(10)
    }
  })

  it('requires auth and workspace membership', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A')
    const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [a])

    const anonRes = await fetchWithJar(new CookieJar(), networkPath(wsId, ctx.boardId, sprintId))
    expect(anonRes.status).toBe(401)

    const stranger = await registerUser('stranger@example.com')
    const strangerRes = await fetchWithJar(stranger.jar, networkPath(wsId, ctx.boardId, sprintId))
    expect(strangerRes.status).toBe(404)
  })
})