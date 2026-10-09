import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { AutomationFiring, AutomationRule, AutomationRunResponse } from '../shared/types/automation'
import type { Notification } from '../shared/types/notification'

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
    headers: { 'x-forwarded-for': `10.3.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

async function addMember(owner: UserCtx, wsId: string, email: string, role: 'viewer' | 'member' | 'scrum_master') {
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

const runPath = (wsId: string, boardId: string) => `/api/workspaces/${wsId}/boards/${boardId}/automations/run`

async function notificationsOf(actor: UserCtx, type = 'automation'): Promise<Notification[]> {
  const res = await fetchWithJar<{ notifications: Notification[] }>(actor.jar, '/api/notifications')
  return res.body.notifications.filter((n) => n.type === type)
}

async function agedTask(owner: UserCtx, wsId: string, ctx: BoardCtx): Promise<string> {
  await getTestSql()`UPDATE boards SET sle_days = 5 WHERE id = ${ctx.boardId}`
  const id = await createTaskIn(owner, wsId, ctx, ctx.columns.backlog, 'old')
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${id}/move`, {
    method: 'POST',
    body: { toColumnId: ctx.columns.in_progress, toPosition: 0 },
  })
  await getTestSql()`
    UPDATE task_events SET created_at = now() - interval '6 days'
    WHERE task_id = ${id} AND event_type = 'task_moved'
  `
  return id
}

describe('automations cron and fan-out', () => {
  it('scheduled task runs every board through tenant context', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    await agedTask(owner, wsId, ctx)

    const res = await fetchWithJar<{ result: { result: string; opened: number; resolved: number } }>(
      owner.jar,
      '/api/_dev/tasks/automations:run/run',
      { method: 'POST' },
    )
    expect(res.status).toBe(200)
    expect(res.body.result.opened).toBeGreaterThanOrEqual(1)

    const unknown = await fetchWithJar(owner.jar, '/api/_dev/tasks/notifications:check-sle-breaches/run', { method: 'POST' })
    expect(unknown.status).toBe(404)
  })

  it('wip_exceeded notifies scrum masters but not members', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const sm = await registerUser('sm@example.com')
    const member = await registerUser('member@example.com')
    await addMember(owner, wsId, sm.email, 'scrum_master')
    await addMember(owner, wsId, member.email, 'member')

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/columns/${ctx.columns.in_progress}`, {
      method: 'PATCH',
      body: { wipLimit: 1 },
    })
    await getTestSql()`UPDATE board_columns SET wip_limit = 1 WHERE id = ${ctx.columns.in_progress}`
    await createTaskIn(owner, wsId, ctx, ctx.columns.in_progress, 'a')
    await createTaskIn(owner, wsId, ctx, ctx.columns.in_progress, 'b')
    await createTaskIn(owner, wsId, ctx, ctx.columns.in_progress, 'c')
    await setRules(wsId, ctx.boardId, [
      { trigger: 'wip_exceeded', triggerParams: {}, action: 'notify', actionParams: { recipients: 'scrum_masters' } },
    ])

    const run = await fetchWithJar<AutomationRunResponse>(owner.jar, runPath(wsId, ctx.boardId), { method: 'POST' })
    expect(run.body).toEqual({ opened: 1, resolved: 0 })
    expect(await notificationsOf(owner)).toHaveLength(1)
    expect(await notificationsOf(sm)).toHaveLength(1)
    expect(await notificationsOf(member)).toHaveLength(0)
    expect((await notificationsOf(sm))[0]!.payload).toMatchObject({ trigger: 'wip_exceeded', count: 3, limit: 1 })
  })

  it('replenishment_overdue with all_members reaches a plain member', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const member = await registerUser('member@example.com')
    await addMember(owner, wsId, member.email, 'member')
    await getTestSql()`
      UPDATE boards SET last_replenishment_at = now() - interval '10 days', replenishment_period_days = 7
      WHERE id = ${ctx.boardId}
    `
    await setRules(wsId, ctx.boardId, [
      { trigger: 'replenishment_overdue', triggerParams: {}, action: 'notify', actionParams: { recipients: 'all_members' } },
    ])

    const run = await fetchWithJar<AutomationRunResponse>(owner.jar, runPath(wsId, ctx.boardId), { method: 'POST' })
    expect(run.body).toEqual({ opened: 1, resolved: 0 })
    const n = await notificationsOf(member)
    expect(n).toHaveLength(1)
    expect(n[0]!.payload).toMatchObject({ trigger: 'replenishment_overdue', daysOverdue: 3 })
  })

  it('concurrent runs open a single firing and a single notification', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const taskId = await agedTask(owner, wsId, ctx)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: { assigneeId: owner.id },
    })

    const results = await Promise.all([
      fetchWithJar<AutomationRunResponse>(owner.jar, runPath(wsId, ctx.boardId), { method: 'POST' }),
      fetchWithJar<AutomationRunResponse>(owner.jar, runPath(wsId, ctx.boardId), { method: 'POST' }),
      fetchWithJar<AutomationRunResponse>(owner.jar, runPath(wsId, ctx.boardId), { method: 'POST' }),
    ])
    expect(results.reduce((n, r) => n + r.body.opened, 0)).toBe(1)
    expect(await notificationsOf(owner)).toHaveLength(1)
    const [row] = await getTestSql()`SELECT COUNT(*)::int AS n FROM automation_firings WHERE resolved_at IS NULL`
    expect(row!.n).toBe(1)
  })

  it('disabling or retargeting a rule resolves its open firings at once', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    await agedTask(owner, wsId, ctx)
    await fetchWithJar(owner.jar, runPath(wsId, ctx.boardId), { method: 'POST' })

    const rules = await fetchWithJar<{ rules: AutomationRule[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/automations/rules`)
    const aging = rules.body.rules.find((r) => r.trigger === 'task_aging')!
    expect(aging.openFirings).toBe(1)

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/automations/rules/${aging.id}`, {
      method: 'PATCH',
      body: { enabled: false },
    })
    const firings = await fetchWithJar<{ firings: AutomationFiring[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/automations/firings`)
    expect(firings.body.firings.filter((f) => f.ruleId === aging.id)).toHaveLength(0)
  })

  it('daily digest survives deleting a rule with open firings', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    await agedTask(owner, wsId, ctx)
    await setRules(wsId, ctx.boardId, [
      { trigger: 'task_aging', triggerParams: { thresholdPct: 85 }, action: 'daily_agenda', actionParams: {} },
    ])
    await fetchWithJar(owner.jar, runPath(wsId, ctx.boardId), { method: 'POST' })
    const rules = await fetchWithJar<{ rules: AutomationRule[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/automations/rules`)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/automations/rules/${rules.body.rules[0]!.id}`, { method: 'DELETE' })

    const daily = await fetchWithJar<{ attention: unknown[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/daily`)
    expect(daily.status).toBe(200)
    expect(daily.body.attention).toEqual([])
  })
})
