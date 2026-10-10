import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { FlowEfficiencyReport } from '../shared/types/analytics'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

type UserCtx = { jar: CookieJar; id: string }

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'correct horse battery 1',
      workspace: { name: 'Reg WS', slug: `reg-${Math.random().toString(36).slice(2, 8)}` },
    },
    headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return { jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(actor.jar, '/api/workspaces', {
    method: 'POST',
    body: { name: 'ACME', slug: 'acme' },
  })
  return res.body.workspace.id
}

type Columns = Record<'backlog' | 'in_progress' | 'review' | 'done', string>
type BoardCtx = { boardId: string; columns: Columns }

async function createBoard(actor: UserCtx, wsId: string): Promise<BoardCtx> {
  const board = await fetchWithJar<{ board: { id: string } }>(actor.jar, `/api/workspaces/${wsId}/boards`, {
    method: 'POST',
    body: { name: 'Main', slug: 'main' },
  })
  const boardId = board.body.board.id
  const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/columns`,
  )
  const columns = Object.fromEntries(cols.body.columns.map((c) => [c.columnRole, c.id])) as Columns
  return { boardId, columns }
}

async function createTask(actor: UserCtx, wsId: string, ctx: BoardCtx, title: string): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks`,
    { method: 'POST', body: { columnId: ctx.columns.backlog, title } },
  )
  return res.body.task.id
}

async function moveTask(actor: UserCtx, wsId: string, ctx: BoardCtx, taskId: string, toColumnId: string) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: { toColumnId, toPosition: 0 },
  })
}

async function setBlocked(actor: UserCtx, wsId: string, ctx: BoardCtx, taskId: string, reason: string | null) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: { blockedReason: reason },
  })
}

async function backdate(taskId: string, eventType: string, hoursAgo: number) {
  const sql = getTestSql()
  await sql`
    UPDATE task_events SET created_at = now() - make_interval(hours => ${hoursAgo})
    WHERE task_id = ${taskId} AND event_type = ${eventType}
  `
}

async function seedClosedTasks(actor: UserCtx, wsId: string, ctx: BoardCtx, count: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const id = await createTask(actor, wsId, ctx, `filler-${i}`)
    await moveTask(actor, wsId, ctx, id, ctx.columns.done)
    ids.push(id)
  }
  return ids
}

function reportPath(wsId: string, boardId: string): string {
  return `/api/workspaces/${wsId}/boards/${boardId}/analytics/flow-efficiency`
}

describe('GET /analytics/flow-efficiency', () => {
  it('returns insufficient_data with fewer than 5 closed tasks', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    await seedClosedTasks(owner, wsId, ctx, 4)

    const res = await fetchWithJar<FlowEfficiencyReport>(owner.jar, reportPath(wsId, ctx.boardId))
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    if (!res.body.ok) expect(res.body.sampleSize).toBe(4)
  })

  it('splits lead time into backlog queue, blocked and active hours', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    await seedClosedTasks(owner, wsId, ctx, 4)

    const id = await createTask(owner, wsId, ctx, 'measured')
    await moveTask(owner, wsId, ctx, id, ctx.columns.in_progress)
    await setBlocked(owner, wsId, ctx, id, 'waiting for backend')
    await setBlocked(owner, wsId, ctx, id, null)
    await moveTask(owner, wsId, ctx, id, ctx.columns.done)
    await backdate(id, 'task_created', 20)
    await backdate(id, 'task_moved', 10)
    await backdate(id, 'task_blocked', 8)
    await backdate(id, 'task_unblocked', 5)

    const res = await fetchWithJar<FlowEfficiencyReport>(owner.jar, reportPath(wsId, ctx.boardId))
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    if (!res.body.ok) return
    expect(res.body.sampleSize).toBe(5)
    expect(res.body.queueHours).toBeCloseTo(10, 1)
    expect(res.body.blockedHours).toBeCloseTo(3, 1)
    expect(res.body.activeHours).toBeCloseTo(7, 1)
    expect(res.body.efficiency).toBeCloseTo(0.35, 2)

    const backlog = res.body.columns.find((c) => c.columnId === ctx.columns.backlog)
    const inProgress = res.body.columns.find((c) => c.columnId === ctx.columns.in_progress)
    expect(backlog?.isQueue).toBe(true)
    expect(backlog?.waitHours).toBeCloseTo(10, 1)
    expect(inProgress?.waitHours).toBeCloseTo(3, 1)
  })

  it('marking a column as queue moves its time from active to wait', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    await seedClosedTasks(owner, wsId, ctx, 4)

    const id = await createTask(owner, wsId, ctx, 'reviewed')
    await moveTask(owner, wsId, ctx, id, ctx.columns.review)
    await moveTask(owner, wsId, ctx, id, ctx.columns.done)
    await backdate(id, 'task_created', 10)
    await backdate(id, 'task_moved', 10)

    const before = await fetchWithJar<FlowEfficiencyReport>(owner.jar, reportPath(wsId, ctx.boardId))
    expect(before.body.ok && before.body.activeHours).toBeCloseTo(10, 1)

    const patch = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/columns/${ctx.columns.review}`,
      { method: 'PATCH', body: { isQueue: true } },
    )
    expect(patch.status).toBe(200)

    const after = await fetchWithJar<FlowEfficiencyReport>(owner.jar, reportPath(wsId, ctx.boardId))
    expect(after.body.ok && after.body.activeHours).toBeCloseTo(0, 1)
    expect(after.body.ok && after.body.queueHours).toBeCloseTo(10, 1)
  })

  it('hides boards from non-members', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const stranger = await registerUser('stranger@example.com')

    const res = await fetchWithJar(stranger.jar, reportPath(wsId, ctx.boardId))
    expect(res.status).toBe(404)
  })
})
