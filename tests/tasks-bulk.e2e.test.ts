// End-to-end tests for /api/workspaces/:id/boards/:boardId/tasks.
// Covers basic CRUD and the RBAC matrix (member can create / edit but
// not delete; viewer can only read). Move-task and state-machine cases
// land in Step 12.
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

async function addMember(
  owner: UserCtx,
  wsId: string,
  email: string,
  role: 'viewer' | 'member' | 'scrum_master' | 'admin',
): Promise<void> {
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
    method: 'POST',
    body: { email, role },
  })
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


type Result = { taskId: string, ok: boolean, error?: string }

async function fixture() {
  const owner = await registerUser('owner@example.com')
  const wsId = await createWorkspace(owner)
  const board = await createBoardWithColumns(owner, wsId)
  const base = `/api/workspaces/${wsId}/boards/${board.boardId}`
  const create = async (title: string, extra: Record<string, unknown> = {}) =>
    (await fetchWithJar<{ task: { id: string } }>(owner.jar, `${base}/tasks`, {
      method: 'POST',
      body: { columnId: board.columns.backlog, title, ...extra },
    })).body.task.id
  const bulk = (actor: UserCtx, taskIds: string[], action: Record<string, unknown>) =>
    fetchWithJar<{ results: Result[] }>(actor.jar, `${base}/tasks/bulk`, { method: 'POST', body: { taskIds, action } })
  const list = async () =>
    (await fetchWithJar<{ tasks: { id: string, columnId: string, serviceClass: string, dueDate: string | null, assigneeIds: string[] }[] }>(owner.jar, `${base}/tasks`)).body.tasks
  return { owner, wsId, base, board, create, bulk, list }
}

describe('POST /tasks/bulk', () => {
  it('moves what fits under the WIP limit and reports the rest per task; a scrum master can force', async () => {
    const { owner, base, board, create, bulk, list } = await fixture()
    await fetchWithJar(owner.jar, `${base}/columns/${board.columns.review}`, { method: 'PATCH', body: { wipLimit: 1 } })
    const ids = [await create('a'), await create('b'), await create('c')]

    const res = await bulk(owner, ids, { type: 'move', columnId: board.columns.review })
    expect(res.status).toBe(200)
    expect(res.body.results.filter(r => r.ok)).toHaveLength(1)
    const refused = res.body.results.filter(r => !r.ok)
    expect(refused).toHaveLength(2)
    expect(refused[0]!.error).toBeTruthy()

    const forced = await bulk(owner, ids, { type: 'move', columnId: board.columns.review, force: true, forceReason: 'релиз' })
    expect(forced.body.results.every(r => r.ok)).toBe(true)
    expect((await list()).filter(t => t.columnId === board.columns.review)).toHaveLength(3)
  })

  it('sets the class and due date, refuses a deadline class without a date, and replaces assignees', async () => {
    const { owner, wsId, create, bulk, list } = await fixture()
    const dev = await registerUser('dev@example.com')
    const qa = await registerUser('qa@example.com')
    await addMember(owner, wsId, dev.email, 'member')
    await addMember(owner, wsId, qa.email, 'member')
    const a = await create('a', { assigneeId: dev.id })
    const b = await create('b')

    const fixed = await bulk(owner, [a, b], { type: 'service_class', value: 'fixed_date' })
    expect(fixed.body.results.every(r => !r.ok)).toBe(true)

    const due = '2026-12-01T23:59:59.000Z'
    expect((await bulk(owner, [a, b], { type: 'due', dueDate: due })).body.results.every(r => r.ok)).toBe(true)
    expect((await bulk(owner, [a, b], { type: 'service_class', value: 'fixed_date' })).body.results.every(r => r.ok)).toBe(true)

    expect((await bulk(owner, [a, b], { type: 'assignee', userId: qa.id })).body.results.every(r => r.ok)).toBe(true)
    const after = await list()
    for (const t of after.filter(t => t.id === a || t.id === b)) {
      expect(t.serviceClass).toBe('fixed_date')
      expect(t.dueDate).toBe(due)
      expect(t.assigneeIds).toEqual([qa.id])
    }

    await bulk(owner, [a], { type: 'assignee', userId: null })
    expect((await list()).find(t => t.id === a)!.assigneeIds).toEqual([])
  })

  it('reports tasks from another board, lets only admins delete and adds to a sprint', async () => {
    const { owner, wsId, base, create, bulk, list } = await fixture()
    const other = await fetchWithJar<{ board: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards`, { method: 'POST', body: { name: 'Other', slug: 'other' } })
    const otherCols = await fetchWithJar<{ columns: { id: string }[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${other.body.board.id}/columns`)
    const foreign = (await fetchWithJar<{ task: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${other.body.board.id}/tasks`, {
      method: 'POST',
      body: { columnId: otherCols.body.columns[0]!.id, title: 'x' },
    })).body.task.id
    const mine = await create('mine')

    const mixed = await bulk(owner, [mine, foreign], { type: 'service_class', value: 'expedite' })
    expect(mixed.body.results.find(r => r.taskId === mine)!.ok).toBe(true)
    expect(mixed.body.results.find(r => r.taskId === foreign)!.ok).toBe(false)

    const sprint = await fetchWithJar<{ sprint: { id: string } }>(owner.jar, `${base}/sprints`, {
      method: 'POST',
      body: { name: 'S1', plannedStartAt: new Date().toISOString(), plannedEndAt: new Date(Date.now() + 7 * 86_400_000).toISOString() },
    })
    expect((await bulk(owner, [mine], { type: 'sprint_add', sprintId: sprint.body.sprint.id })).body.results[0]!.ok).toBe(true)
    const sprintGet = await fetchWithJar<{ taskIds: string[] }>(owner.jar, `${base}/sprints/${sprint.body.sprint.id}`)
    expect(sprintGet.body.taskIds).toContain(mine)

    const dev = await registerUser('dev@example.com')
    await addMember(owner, wsId, dev.email, 'member')
    expect((await bulk(dev, [mine], { type: 'delete' })).status).toBe(403)
    expect((await bulk(owner, [mine], { type: 'delete' })).body.results[0]!.ok).toBe(true)
    expect((await list()).some(t => t.id === mine)).toBe(false)
  })
})
