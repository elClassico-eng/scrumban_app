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

type UserCtx = { email: string, jar: CookieJar, id: string }
type Notif = { id: string, type: string, workspaceId: string, payload: Record<string, unknown> }
type Comment = { id: string }

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: { email, password: 'correct horse battery 1', workspace: { name: 'Reg WS', slug: `reg-${email.split('@')[0]}` } },
    headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return { email, jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx, slug = 'acme'): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(actor.jar, '/api/workspaces', {
    method: 'POST',
    body: { name: slug.toUpperCase(), slug },
  })
  return res.body.workspace.id
}

async function addMember(owner: UserCtx, wsId: string, email: string, role: 'viewer' | 'member' | 'scrum_master' | 'admin') {
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, { method: 'POST', body: { email, role } })
}

async function createBoard(actor: UserCtx, wsId: string): Promise<{ boardId: string, backlog: string }> {
  const board = await fetchWithJar<{ board: { id: string } }>(actor.jar, `/api/workspaces/${wsId}/boards`, {
    method: 'POST',
    body: { name: 'Main', slug: 'main' },
  })
  const boardId = board.body.board.id
  const cols = await fetchWithJar<{ columns: { id: string, columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/columns`,
  )
  return { boardId, backlog: cols.body.columns.find(c => c.columnRole === 'backlog')!.id }
}

async function createTask(actor: UserCtx, wsId: string, boardId: string, columnId: string, extra: Record<string, unknown> = {}) {
  const res = await fetchWithJar<{ task: { id: string } }>(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
    method: 'POST',
    body: { columnId, title: 'T', ...extra },
  })
  return res.body.task.id
}

function commentsUrl(wsId: string, boardId: string, taskId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`
}

async function comment(actor: UserCtx, url: string, body: string, parentId?: string) {
  return fetchWithJar<{ comment: Comment }>(actor.jar, url, { method: 'POST', body: { body, parentId } })
}

async function notifs(actor: UserCtx, query = ''): Promise<Notif[]> {
  const res = await fetchWithJar<{ notifications: Notif[] }>(actor.jar, `/api/notifications${query}`)
  return res.body.notifications
}

async function team() {
  const owner = await registerUser('owner@example.com')
  const ann = await registerUser('ann@example.com')
  const igor = await registerUser('igor@example.com')
  const vera = await registerUser('vera@example.com')
  const wsId = await createWorkspace(owner)
  await addMember(owner, wsId, ann.email, 'member')
  await addMember(owner, wsId, igor.email, 'member')
  await addMember(owner, wsId, vera.email, 'viewer')
  const { boardId, backlog } = await createBoard(owner, wsId)
  const taskId = await createTask(owner, wsId, boardId, backlog)
  return { owner, ann, igor, vera, wsId, boardId, backlog, taskId, url: commentsUrl(wsId, boardId, taskId) }
}

function watchersUrl(wsId: string, boardId: string, taskId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/watchers`
}

async function watchers(actor: UserCtx, url: string): Promise<string[]> {
  return (await fetchWithJar<{ watchers: string[] }>(actor.jar, url)).body.watchers
}

describe('task watchers', () => {
  it('the creator watches automatically and anyone, even a viewer, can watch and unwatch', async () => {
    const { owner, vera, wsId, boardId, taskId } = await team()
    const url = watchersUrl(wsId, boardId, taskId)
    expect(await watchers(owner, url)).toEqual([owner.id])

    expect((await fetchWithJar(vera.jar, `${url}/me`, { method: 'PUT' })).status).toBe(200)
    expect((await watchers(owner, url)).sort()).toEqual([owner.id, vera.id].sort())
    await fetchWithJar(vera.jar, `${url}/me`, { method: 'DELETE' })
    expect(await watchers(owner, url)).toEqual([owner.id])
  })

  it('watchers hear about comments once, the author and people notified more specifically do not', async () => {
    const { owner, ann, igor, vera, wsId, boardId, taskId, url } = await team()
    await fetchWithJar(vera.jar, `${watchersUrl(wsId, boardId, taskId)}/me`, { method: 'PUT' })
    await fetchWithJar(igor.jar, `${watchersUrl(wsId, boardId, taskId)}/me`, { method: 'PUT' })

    await comment(ann, url, `@[Igor](${igor.id}) посмотри`)

    expect((await notifs(owner)).map(n => n.type)).toEqual(['watched_comment'])
    expect((await notifs(vera)).map(n => n.type)).toEqual(['watched_comment'])
    expect((await notifs(igor)).map(n => n.type)).toEqual(['mention'])
    expect(await notifs(ann)).toEqual([])
    expect(await watchers(owner, watchersUrl(wsId, boardId, taskId))).toContain(ann.id)
  })

  it('a move to another column notifies watchers except whoever moved it', async () => {
    const { owner, ann, wsId, boardId, taskId } = await team()
    await fetchWithJar(ann.jar, `${watchersUrl(wsId, boardId, taskId)}/me`, { method: 'PUT' })
    const cols = await fetchWithJar<{ columns: { id: string, columnRole: string }[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`)
    const inProgress = cols.body.columns.find(c => c.columnRole === 'in_progress')!.id

    const moved = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`, {
      method: 'POST',
      body: { toColumnId: inProgress, toPosition: 0 },
    })
    expect(moved.status).toBe(200)
    const annNotifs = await notifs(ann)
    expect(annNotifs.map(n => n.type)).toEqual(['watched_status'])
    expect(annNotifs[0]!.payload.columnRole).toBe('in_progress')
    expect(await notifs(owner)).toEqual([])
  })
})
