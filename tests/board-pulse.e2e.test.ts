import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { BoardPulse } from '../shared/types/pulse'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

type UserCtx = { jar: CookieJar; id: string; email: string }

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'correct horse battery 1',
      workspace: { name: 'Reg WS', slug: `reg-${Math.random().toString(36).slice(2, 8)}` },
    },
    headers: { 'x-forwarded-for': `10.4.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return { jar, id: res.body.user.id, email }
}

async function createWorkspace(actor: UserCtx): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(actor.jar, '/api/workspaces', {
    method: 'POST',
    body: { name: 'ACME', slug: 'acme' },
  })
  return res.body.workspace.id
}

async function addMember(owner: UserCtx, wsId: string, email: string, role: 'viewer' | 'member') {
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, { method: 'POST', body: { email, role } })
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

async function createTaskIn(actor: UserCtx, wsId: string, ctx: BoardCtx, columnId: string, title: string): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks`,
    { method: 'POST', body: { columnId, title } },
  )
  return res.body.task.id
}

async function patchTask(actor: UserCtx, wsId: string, ctx: BoardCtx, taskId: string, body: Record<string, unknown>) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}`, { method: 'PATCH', body })
}

async function moveTask(actor: UserCtx, wsId: string, ctx: BoardCtx, taskId: string, toColumnId: string) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: { toColumnId, toPosition: 0 },
  })
}

async function backdate(taskId: string, eventType: string, hoursAgo: number) {
  await getTestSql()`
    UPDATE task_events SET created_at = now() - make_interval(hours => ${hoursAgo})
    WHERE task_id = ${taskId} AND event_type = ${eventType}
  `
}

async function setRules(wsId: string, boardId: string, rules: { trigger: string; triggerParams: Record<string, unknown>; action: string; actionParams: Record<string, unknown> }[]) {
  const sql = getTestSql()
  await sql`DELETE FROM automation_rules WHERE board_id = ${boardId}`
  for (const r of rules) {
    await sql`
      INSERT INTO automation_rules (workspace_id, board_id, trigger, trigger_params, action, action_params)
      VALUES (${wsId}, ${boardId}, ${r.trigger}::automation_trigger, ${JSON.stringify(r.triggerParams)}::jsonb,
        ${r.action}::automation_action, ${JSON.stringify(r.actionParams)}::jsonb)
    `
  }
}

const pulsePath = (wsId: string, boardId: string) => `/api/workspaces/${wsId}/boards/${boardId}/pulse`

describe('GET /boards/:id/pulse', () => {
  it('empty board returns zeros and nulls', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const res = await fetchWithJar<BoardPulse>(owner.jar, pulsePath(wsId, ctx.boardId))
    expect(res.status).toBe(200)
    expect(res.body.board.id).toBe(ctx.boardId)
    expect(res.body.aging).toEqual({ count: 0, p85Days: null })
    expect(res.body.blockers).toEqual({ count: 0, longestDays: null })
    expect(res.body.firings).toEqual({ count: 0, latestTrigger: null })
    expect(res.body.myTasks).toEqual({ open: 0, inProgress: 0 })
    expect(res.body.dueSoon).toBeNull()
    expect(res.body.throughput7).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(res.body.sprint).toBeNull()
    expect(res.body.wip.map((c) => c.name)).toEqual(['In Progress', 'Review'])
  })

  it('counts wip, blockers, my tasks, due soon and firings', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    await getTestSql()`UPDATE board_columns SET wip_limit = 1 WHERE id = ${ctx.columns.in_progress}`
    const a = await createTaskIn(owner, wsId, ctx, ctx.columns.in_progress, 'a')
    const b = await createTaskIn(owner, wsId, ctx, ctx.columns.in_progress, 'b')
    const due = new Date(Date.now() + 2 * 86_400_000).toISOString()
    await patchTask(owner, wsId, ctx, a, { assigneeId: owner.id, dueDate: due })
    await patchTask(owner, wsId, ctx, b, { blockedReason: 'ждём' })
    await getTestSql()`UPDATE task_events SET created_at = now() - interval '3 days' WHERE task_id = ${b} AND event_type = 'task_blocked'`
    await setRules(wsId, ctx.boardId, [{ trigger: 'task_blocked', triggerParams: { days: 2 }, action: 'daily_agenda', actionParams: {} }])
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/automations/run`, { method: 'POST' })

    const res = await fetchWithJar<BoardPulse>(owner.jar, pulsePath(wsId, ctx.boardId))
    expect(res.status).toBe(200)
    const inProgress = res.body.wip.find((c) => c.columnId === ctx.columns.in_progress)!
    expect(inProgress).toMatchObject({ count: 2, limit: 1 })
    expect(res.body.blockers.count).toBe(1)
    expect(res.body.blockers.longestDays).toBeCloseTo(3, 0)
    expect(res.body.myTasks).toEqual({ open: 1, inProgress: 1 })
    expect(res.body.dueSoon).toMatchObject({ taskId: a, title: 'a' })
    expect(res.body.firings).toEqual({ count: 1, latestTrigger: 'task_blocked' })
  })

  it('throughput7 counts closes per day and aging uses p85', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    for (let i = 0; i < 6; i++) {
      const id = await createTaskIn(owner, wsId, ctx, ctx.columns.backlog, `h${i}`)
      await moveTask(owner, wsId, ctx, id, ctx.columns.done)
      await backdate(id, 'task_created', 24 * (i + 1) + 1)
    }
    const old = await createTaskIn(owner, wsId, ctx, ctx.columns.in_progress, 'old')
    await backdate(old, 'task_created', 24 * 30)
    await getTestSql()`UPDATE tasks SET created_at = now() - interval '30 days' WHERE id = ${old}`

    const res = await fetchWithJar<BoardPulse>(owner.jar, pulsePath(wsId, ctx.boardId))
    expect(res.body.throughput7.reduce((a, b) => a + b, 0)).toBe(6)
    expect(res.body.throughput7[6]).toBe(6)
    expect(res.body.aging.p85Days).not.toBeNull()
    expect(res.body.aging.count).toBe(1)
  })

  it('viewer gets 200, stranger 404', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const viewer = await registerUser('viewer@example.com')
    await addMember(owner, wsId, viewer.email, 'viewer')
    const ok = await fetchWithJar(viewer.jar, pulsePath(wsId, ctx.boardId))
    expect(ok.status).toBe(200)
    const stranger = await registerUser('stranger@example.com')
    const no = await fetchWithJar(stranger.jar, pulsePath(wsId, ctx.boardId))
    expect(no.status).toBe(404)
  })
})
