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
    { method: 'POST', body: { email, password: 'correct horse battery' } },
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

async function createBoardWithColumns(actor: UserCtx, wsId: string, slug = 'main'): Promise<BoardCtx> {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: slug, slug } },
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
  title = 'T',
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title } },
  )
  return res.body.task.id
}

describe('GET /workspaces/:id/activity', () => {
  it('lists events for the workspace newest-first with task and actor info', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog, 'Implement login')

    const res = await fetchWithJar<{
      events: {
        eventType: string
        taskId: string
        taskTitle: string | null
        boardId: string | null
        boardName: string | null
        actorId: string | null
        actorEmail: string | null
      }[]
    }>(owner.jar, `/api/workspaces/${wsId}/activity`)

    expect(res.status).toBe(200)
    const created = res.body.events.find(e => e.eventType === 'task_created' && e.taskId === taskId)
    expect(created).toBeTruthy()
    expect(created!.taskTitle).toBe('Implement login')
    expect(created!.boardId).toBe(boardId)
    expect(created!.boardName).toBe('main')
    expect(created!.actorId).toBe(owner.id)
    expect(created!.actorEmail).toBe('owner@example.com')
  })

  it('filters by board', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const a = await createBoardWithColumns(owner, wsId, 'alpha')
    const b = await createBoardWithColumns(owner, wsId, 'beta')
    await createTask(owner, wsId, a.boardId, a.columns.backlog, 'alpha task')
    await createTask(owner, wsId, b.boardId, b.columns.backlog, 'beta task')

    const res = await fetchWithJar<{ events: { boardId: string; taskTitle: string | null }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/activity?board=${a.boardId}`,
    )
    expect(res.body.events.every(e => e.boardId === a.boardId)).toBe(true)
    expect(res.body.events.some(e => e.taskTitle === 'beta task')).toBe(false)
  })

  it('filters by actor', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await createTask(owner, wsId, boardId, columns.backlog, 'by owner')
    await createTask(dev, wsId, boardId, columns.backlog, 'by dev')

    const res = await fetchWithJar<{ events: { actorId: string | null; taskTitle: string | null }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/activity?actor=${dev.id}`,
    )
    expect(res.body.events.length).toBeGreaterThan(0)
    expect(res.body.events.every(e => e.actorId === dev.id)).toBe(true)
  })

  it('filters by comma-separated event types', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'hi' } },
    )

    const res = await fetchWithJar<{ events: { eventType: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/activity?event=task_commented,task_created`,
    )
    const types = new Set(res.body.events.map(e => e.eventType))
    expect(types.has('task_created')).toBe(true)
    expect(types.has('task_commented')).toBe(true)
    expect(types.has('task_moved')).toBe(false)
  })

  it('filters by date range', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await createTask(owner, wsId, boardId, columns.backlog)

    const past = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const futurePast = new Date(Date.now() - 20 * 86_400_000).toISOString()
    const res = await fetchWithJar<{ events: unknown[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/activity?from=${encodeURIComponent(past)}&to=${encodeURIComponent(futurePast)}`,
    )
    expect(res.body.events.length).toBe(0)
  })

  it('viewer can read the feed', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await createTask(owner, wsId, boardId, columns.backlog)

    const res = await fetchWithJar<{ events: unknown[] }>(
      viewer.jar,
      `/api/workspaces/${wsId}/activity`,
    )
    expect(res.status).toBe(200)
    expect(res.body.events.length).toBeGreaterThan(0)
  })

  it('non-member is forbidden', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await createTask(owner, wsId, boardId, columns.backlog)

    const res = await fetchWithJar(stranger.jar, `/api/workspaces/${wsId}/activity`)
    expect(res.status).toBe(404)
  })

  it('orphan event (actor deleted) returns null actor fields without crashing', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await createTask(dev, wsId, boardId, columns.backlog, 'by dev')

    const sql = getTestSql()
    await sql.unsafe(`DELETE FROM users WHERE id = '${dev.id}'`)

    const res = await fetchWithJar<{ events: { actorId: string | null; actorEmail: string | null }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/activity`,
    )
    expect(res.status).toBe(200)
    const orphans = res.body.events.filter(e => e.actorId === null)
    expect(orphans.length).toBeGreaterThan(0)
    expect(orphans[0]!.actorEmail).toBeNull()
  })
})