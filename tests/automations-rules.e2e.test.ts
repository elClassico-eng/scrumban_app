import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { AutomationFiring, AutomationRule } from '../shared/types/automation'

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
    headers: { 'x-forwarded-for': `10.2.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

async function createBoard(actor: UserCtx, wsId: string): Promise<{ boardId: string; columns: Columns }> {
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

const rulesPath = (wsId: string, boardId: string) => `/api/workspaces/${wsId}/boards/${boardId}/automations/rules`

async function listRules(actor: UserCtx, wsId: string, boardId: string) {
  return fetchWithJar<{ rules: AutomationRule[] }>(actor.jar, rulesPath(wsId, boardId))
}

describe('automation rules API', () => {
  it('new board lists no rules; member cannot create; viewer can read', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoard(owner, wsId)

    const list = await listRules(owner, wsId, boardId)
    expect(list.status).toBe(200)
    expect(list.body.rules).toEqual([])
    await fetchWithJar(owner.jar, rulesPath(wsId, boardId), {
      method: 'POST',
      body: { trigger: 'task_aging', triggerParams: {}, action: 'notify', actionParams: { recipients: 'assignee' } },
    })

    const member = await registerUser('member@example.com')
    await addMember(owner, wsId, member.email, 'member')
    const forbidden = await fetchWithJar(member.jar, rulesPath(wsId, boardId), {
      method: 'POST',
      body: { trigger: 'task_blocked', triggerParams: {}, action: 'daily_agenda', actionParams: {} },
    })
    expect(forbidden.status).toBe(403)

    const viewer = await registerUser('viewer@example.com')
    await addMember(owner, wsId, viewer.email, 'viewer')
    const asViewer = await listRules(viewer, wsId, boardId)
    expect(asViewer.status).toBe(200)
    expect(asViewer.body.rules).toHaveLength(1)
    expect(asViewer.body.rules[0]!.openFirings).toBe(0)
  })

  it('creates, patches and deletes a rule', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoard(owner, wsId)

    const created = await fetchWithJar<{ rule: AutomationRule }>(owner.jar, rulesPath(wsId, boardId), {
      method: 'POST',
      body: { trigger: 'task_blocked', triggerParams: {}, action: 'daily_agenda', actionParams: {} },
    })
    expect(created.status).toBe(201)
    expect(created.body.rule.triggerParams).toEqual({ days: 2 })
    const ruleId = created.body.rule.id

    const toggled = await fetchWithJar<{ rule: AutomationRule }>(owner.jar, `${rulesPath(wsId, boardId)}/${ruleId}`, {
      method: 'PATCH',
      body: { enabled: false },
    })
    expect(toggled.status).toBe(200)
    expect(toggled.body.rule.enabled).toBe(false)

    const reparam = await fetchWithJar<{ rule: AutomationRule }>(owner.jar, `${rulesPath(wsId, boardId)}/${ruleId}`, {
      method: 'PATCH',
      body: { triggerParams: { days: 5 } },
    })
    expect(reparam.status).toBe(200)
    expect(reparam.body.rule.triggerParams).toEqual({ days: 5 })
    expect(reparam.body.rule.enabled).toBe(false)

    const removed = await fetchWithJar(owner.jar, `${rulesPath(wsId, boardId)}/${ruleId}`, { method: 'DELETE' })
    expect(removed.status).toBe(204)
    const list = await listRules(owner, wsId, boardId)
    expect(list.body.rules.find((r) => r.id === ruleId)).toBeUndefined()
  })

  it('rejects incompatible trigger+action with 400', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoard(owner, wsId)

    const res = await fetchWithJar(owner.jar, rulesPath(wsId, boardId), {
      method: 'POST',
      body: { trigger: 'sprint_forecast', triggerParams: { minProbability: 70 }, action: 'comment', actionParams: {} },
    })
    expect(res.status).toBe(400)
  })

  it('deleting a rule removes its firings', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoard(owner, wsId)
    const task = await fetchWithJar<{ task: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: columns.backlog, title: 'stuck' },
    })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${task.body.task.id}`, {
      method: 'PATCH',
      body: { blockedReason: 'ждём' },
    })
    await getTestSql()`UPDATE task_events SET created_at = now() - interval '5 days' WHERE task_id = ${task.body.task.id} AND event_type = 'task_blocked'`

    const created = await fetchWithJar<{ rule: AutomationRule }>(owner.jar, rulesPath(wsId, boardId), {
      method: 'POST',
      body: { trigger: 'task_blocked', triggerParams: { days: 2 }, action: 'daily_agenda', actionParams: {} },
    })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/automations/run`, { method: 'POST' })

    const before = await fetchWithJar<{ firings: AutomationFiring[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/automations/firings`)
    expect(before.body.firings.filter((f) => f.ruleId === created.body.rule.id)).toHaveLength(1)

    await fetchWithJar(owner.jar, `${rulesPath(wsId, boardId)}/${created.body.rule.id}`, { method: 'DELETE' })
    const after = await fetchWithJar<{ firings: AutomationFiring[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/automations/firings`)
    expect(after.status).toBe(200)
    expect(after.body.firings.filter((f) => f.ruleId === created.body.rule.id)).toHaveLength(0)
  })

  it('rejects a board from another workspace with 404', async () => {
    const owner = await registerUser('owner@example.com')
    const wsA = await createWorkspace(owner)
    const wsB = await fetchWithJar<{ workspace: { id: string } }>(owner.jar, '/api/workspaces', {
      method: 'POST',
      body: { name: 'B', slug: 'b-ws' },
    })
    const { boardId } = await createBoard(owner, wsA)
    const res = await fetchWithJar(owner.jar, rulesPath(wsB.body.workspace.id, boardId), {
      method: 'POST',
      body: { trigger: 'task_blocked', triggerParams: {}, action: 'daily_agenda', actionParams: {} },
    })
    expect(res.status).toBe(404)
  })

  it('hides from non-members', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoard(owner, wsId)
    const stranger = await registerUser('stranger@example.com')
    const res = await listRules(stranger, wsId, boardId)
    expect(res.status).toBe(404)
  })
})
