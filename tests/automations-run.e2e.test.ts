import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { AutomationRunResponse } from '../shared/types/automation'
import type { Notification } from '../shared/types/notification'
import type { TaskComment } from '../shared/types/comment'

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
    headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

async function patchTask(actor: UserCtx, wsId: string, ctx: BoardCtx, taskId: string, body: Record<string, unknown>) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}`, {
    method: 'PATCH',
    body,
  })
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

async function setSle(boardId: string, days: number) {
  await getTestSql()`UPDATE boards SET sle_days = ${days} WHERE id = ${boardId}`
}

type RuleSeed = {
  trigger: string
  triggerParams: Record<string, unknown>
  action: string
  actionParams: Record<string, unknown>
}

async function setRules(wsId: string, boardId: string, rules: RuleSeed[]) {
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

async function runAutomations(actor: UserCtx, wsId: string, boardId: string) {
  return fetchWithJar<AutomationRunResponse>(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/automations/run`, {
    method: 'POST',
  })
}

async function listNotifications(actor: UserCtx): Promise<Notification[]> {
  const res = await fetchWithJar<{ notifications: Notification[] }>(actor.jar, '/api/notifications')
  return res.body.notifications
}

async function agedTaskBoard(owner: UserCtx) {
  const wsId = await createWorkspace(owner)
  const ctx = await createBoard(owner, wsId)
  await setSle(ctx.boardId, 5)
  const taskId = await createTask(owner, wsId, ctx, 'old')
  await moveTask(owner, wsId, ctx, taskId, ctx.columns.in_progress)
  await backdate(taskId, 'task_moved', 24 * 6)
  return { wsId, ctx, taskId }
}

describe('automations run', () => {
  it('opens a firing and notifies the assignee when a task ages past SLE', async () => {
    const owner = await registerUser('owner@example.com')
    const { wsId, ctx, taskId } = await agedTaskBoard(owner)
    await patchTask(owner, wsId, ctx, taskId, { assigneeId: owner.id })

    const run = await runAutomations(owner, wsId, ctx.boardId)
    expect(run.status).toBe(200)
    expect(run.body).toEqual({ opened: 1, resolved: 0 })

    const n = (await listNotifications(owner)).find((x) => x.type === 'automation')
    expect(n?.payload).toMatchObject({ trigger: 'task_aging', taskId, pct: 120, sleDays: 5 })

    const again = await runAutomations(owner, wsId, ctx.boardId)
    expect(again.body).toEqual({ opened: 0, resolved: 0 })

    await moveTask(owner, wsId, ctx, taskId, ctx.columns.done)
    const after = await runAutomations(owner, wsId, ctx.boardId)
    expect(after.body).toEqual({ opened: 0, resolved: 1 })
  })

  it('task_aging returns nothing without SLE', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const taskId = await createTask(owner, wsId, ctx, 'old')
    await moveTask(owner, wsId, ctx, taskId, ctx.columns.in_progress)
    await backdate(taskId, 'task_moved', 24 * 30)

    const run = await runAutomations(owner, wsId, ctx.boardId)
    expect(run.body).toEqual({ opened: 0, resolved: 0 })
  })

  it('skips notify when task has no assignee', async () => {
    const owner = await registerUser('owner@example.com')
    const { wsId, ctx } = await agedTaskBoard(owner)

    const run = await runAutomations(owner, wsId, ctx.boardId)
    expect(run.body).toEqual({ opened: 1, resolved: 0 })
    expect((await listNotifications(owner)).filter((x) => x.type === 'automation')).toHaveLength(0)
  })

  it('respects notification prefs', async () => {
    const owner = await registerUser('owner@example.com')
    const { wsId, ctx, taskId } = await agedTaskBoard(owner)
    await patchTask(owner, wsId, ctx, taskId, { assigneeId: owner.id })
    await fetchWithJar(owner.jar, '/api/users/me', {
      method: 'PATCH',
      body: { notificationPrefs: { automation: false } },
    })

    const run = await runAutomations(owner, wsId, ctx.boardId)
    expect(run.body).toEqual({ opened: 1, resolved: 0 })
    expect((await listNotifications(owner)).filter((x) => x.type === 'automation')).toHaveLength(0)
  })

  it('comment action writes a system comment without notification', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const taskId = await createTask(owner, wsId, ctx, 'stuck')
    await patchTask(owner, wsId, ctx, taskId, { assigneeId: owner.id, blockedReason: 'ждём бэкенд' })
    await backdate(taskId, 'task_blocked', 24 * 3)
    await setRules(wsId, ctx.boardId, [
      { trigger: 'task_blocked', triggerParams: { days: 2 }, action: 'comment', actionParams: {} },
    ])

    const run = await runAutomations(owner, wsId, ctx.boardId)
    expect(run.body).toEqual({ opened: 1, resolved: 0 })

    const comments = await fetchWithJar<{ comments: TaskComment[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}/comments`,
    )
    expect(comments.body.comments).toHaveLength(1)
    expect(comments.body.comments[0]!.author).toBeNull()
    expect(comments.body.comments[0]!.body).toContain('3 дн')
    expect((await listNotifications(owner)).filter((x) => x.type !== 'assigned')).toHaveLength(0)
  })

  it('daily_agenda action surfaces the firing in the daily digest', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const taskId = await createTask(owner, wsId, ctx, 'stuck')
    await patchTask(owner, wsId, ctx, taskId, { blockedReason: 'ждём дизайн' })
    await backdate(taskId, 'task_blocked', 24 * 3)
    await setRules(wsId, ctx.boardId, [
      { trigger: 'task_blocked', triggerParams: { days: 2 }, action: 'daily_agenda', actionParams: {} },
    ])
    await runAutomations(owner, wsId, ctx.boardId)

    const daily = await fetchWithJar<{ attention: { trigger: string; payload: Record<string, unknown> }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/daily`,
    )
    expect(daily.status).toBe(200)
    expect(daily.body.attention).toHaveLength(1)
    expect(daily.body.attention[0]).toMatchObject({ trigger: 'task_blocked' })
    expect(daily.body.attention[0]!.payload).toMatchObject({ taskId, reason: 'ждём дизайн' })
  })

  it('disabled rule resolves its open firings', async () => {
    const owner = await registerUser('owner@example.com')
    const { wsId, ctx } = await agedTaskBoard(owner)
    const first = await runAutomations(owner, wsId, ctx.boardId)
    expect(first.body.opened).toBe(1)

    await getTestSql()`UPDATE automation_rules SET enabled = false WHERE board_id = ${ctx.boardId}`
    const second = await runAutomations(owner, wsId, ctx.boardId)
    expect(second.body).toEqual({ opened: 0, resolved: 1 })
  })

  it('new board gets 3 preset rules and member cannot run', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const [row] = await getTestSql()`SELECT COUNT(*)::int AS n FROM automation_rules WHERE board_id = ${ctx.boardId}`
    expect(row!.n).toBe(3)

    const stranger = await registerUser('stranger@example.com')
    const res = await runAutomations(stranger, wsId, ctx.boardId)
    expect(res.status).toBe(404)
  })
})
