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
type Comment = { id: string, parentId: string | null, assigneeId: string | null, resolvedAt: string | null }

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

describe('comment replies', () => {
  it('notifies the root author and earlier repliers, never the replier', async () => {
    const { ann, igor, owner, url } = await team()
    const root = await comment(ann, url, 'Миграция готова?')
    await comment(igor, url, 'Да, на стейдже', root.body.comment.id)
    await comment(owner, url, 'Отлично', root.body.comment.id)

    expect((await notifs(ann)).filter(n => n.type === 'reply').length).toBe(2)
    expect((await notifs(igor)).filter(n => n.type === 'reply').length).toBe(1)
    expect((await notifs(owner)).filter(n => n.type === 'reply').length).toBe(0)
  })

  it('a reply to a reply joins the root thread', async () => {
    const { ann, igor, url } = await team()
    const root = await comment(ann, url, 'root')
    const first = await comment(igor, url, 'first', root.body.comment.id)
    const second = await comment(ann, url, 'second', first.body.comment.id)
    expect(second.status).toBe(200)
    expect(second.body.comment.parentId).toBe(root.body.comment.id)
  })

  it('a mention of the root author does not double up with reply', async () => {
    const { ann, igor, url } = await team()
    const root = await comment(ann, url, 'root')
    await comment(igor, url, `@[Ann](${ann.id}) глянь`, root.body.comment.id)
    const types = (await notifs(ann)).map(n => n.type)
    expect(types.filter(t => t === 'mention').length).toBe(1)
    expect(types.filter(t => t === 'reply').length).toBe(0)
  })

  it('rejects a parent from another task', async () => {
    const { ann, owner, wsId, boardId, backlog, url } = await team()
    const otherTask = await createTask(owner, wsId, boardId, backlog)
    const foreign = await comment(ann, url, 'root')
    const res = await comment(ann, commentsUrl(wsId, boardId, otherTask), 'x', foreign.body.comment.id)
    expect(res.status).toBe(404)
  })
})

describe('assigned comments', () => {
  function assignmentUrl(url: string, commentId: string) {
    return `${url}/${commentId}/assignment`
  }

  it('author assigns own comment to a member, who gets comment_assigned', async () => {
    const { ann, igor, url } = await team()
    const c = await comment(ann, url, 'проверь миграцию')
    const res = await fetchWithJar<{ comment: Comment }>(ann.jar, assignmentUrl(url, c.body.comment.id), {
      method: 'PATCH',
      body: { assigneeId: igor.id },
    })
    expect(res.status).toBe(200)
    expect(res.body.comment.assigneeId).toBe(igor.id)
    expect((await notifs(igor)).map(n => n.type)).toContain('comment_assigned')
  })

  it('a member cannot assign someone else\'s comment, a scrum master can', async () => {
    const { owner, ann, igor, wsId, url } = await team()
    const c = await comment(ann, url, 'x')
    const denied = await fetchWithJar(igor.jar, assignmentUrl(url, c.body.comment.id), {
      method: 'PATCH',
      body: { assigneeId: igor.id },
    })
    expect(denied.status).toBe(403)

    const sm = await registerUser('sm@example.com')
    await addMember(owner, wsId, sm.email, 'scrum_master')
    const ok = await fetchWithJar(sm.jar, assignmentUrl(url, c.body.comment.id), {
      method: 'PATCH',
      body: { assigneeId: igor.id },
    })
    expect(ok.status).toBe(200)
  })

  it('a viewer cannot be assigned', async () => {
    const { ann, vera, url } = await team()
    const c = await comment(ann, url, 'x')
    const res = await fetchWithJar(ann.jar, assignmentUrl(url, c.body.comment.id), {
      method: 'PATCH',
      body: { assigneeId: vera.id },
    })
    expect(res.status).toBe(422)
  })

  it('the assignee resolves, a bystander cannot, and the open list is mine only', async () => {
    const { owner, ann, igor, wsId, url } = await team()
    const c1 = await comment(ann, url, 'one')
    const c2 = await comment(ann, url, 'two')
    for (const c of [c1, c2]) {
      await fetchWithJar(ann.jar, assignmentUrl(url, c.body.comment.id), { method: 'PATCH', body: { assigneeId: igor.id } })
    }

    const bystander = await registerUser('by@example.com')
    await addMember(owner, wsId, bystander.email, 'member')
    const denied = await fetchWithJar(bystander.jar, assignmentUrl(url, c1.body.comment.id), {
      method: 'PATCH',
      body: { resolved: true },
    })
    expect(denied.status).toBe(403)

    const resolved = await fetchWithJar<{ comment: Comment }>(igor.jar, assignmentUrl(url, c1.body.comment.id), {
      method: 'PATCH',
      body: { resolved: true },
    })
    expect(resolved.status).toBe(200)
    expect(resolved.body.comment.resolvedAt).not.toBeNull()

    const mine = await fetchWithJar<{ comments: { id: string, taskTitle: string }[] }>(
      igor.jar,
      `/api/workspaces/${wsId}/assigned-comments`,
    )
    expect(mine.body.comments.map(c => c.id)).toEqual([c2.body.comment.id])
    expect(mine.body.comments[0]!.taskTitle).toBe('T')

    const others = await fetchWithJar<{ comments: unknown[] }>(ann.jar, `/api/workspaces/${wsId}/assigned-comments`)
    expect(others.body.comments.length).toBe(0)
  })
})

describe('inbox filters', () => {
  it('filters notifications by workspace and type, and counts unread per workspace', async () => {
    const { owner, ann, igor, wsId, url } = await team()
    const root = await comment(ann, url, 'root')
    await comment(igor, url, 'reply', root.body.comment.id)
    await comment(igor, url, `@[Ann](${ann.id})`)

    const otherWs = await createWorkspace(owner, 'other')
    await addMember(owner, otherWs, ann.email, 'member')
    const other = await createBoard(owner, otherWs)
    const otherTask = await createTask(owner, otherWs, other.boardId, other.backlog)
    await comment(owner, commentsUrl(otherWs, other.boardId, otherTask), `@[Ann](${ann.id})`)

    expect((await notifs(ann, `?workspaceId=${wsId}`)).length).toBe(2)
    expect((await notifs(ann, `?workspaceId=${wsId}&types=reply`)).map(n => n.type)).toEqual(['reply'])
    const count = await fetchWithJar<{ count: number }>(ann.jar, `/api/notifications/unread-count?workspaceId=${otherWs}`)
    expect(count.body.count).toBe(1)
  })

  it('pages with a before cursor', async () => {
    const { ann, igor, url } = await team()
    for (let i = 0; i < 3; i++) await comment(igor, url, `@[Ann](${ann.id}) ${i}`)
    const firstPage = await notifs(ann, '?limit=2')
    expect(firstPage.length).toBe(2)
    const before = encodeURIComponent((firstPage[1] as unknown as { createdAt: string }).createdAt)
    expect((await notifs(ann, `?limit=2&before=${before}`)).length).toBe(1)
  })
})

describe('my tasks', () => {
  it('assignee=me returns only tasks assigned to the caller', async () => {
    const { owner, ann, wsId, boardId, backlog } = await team()
    const mine = await createTask(owner, wsId, boardId, backlog, { assigneeId: ann.id, title: 'Моя' })
    await createTask(owner, wsId, boardId, backlog, { title: 'Чужая' })

    const res = await fetchWithJar<{ tasks: { id: string }[] }>(ann.jar, `/api/workspaces/${wsId}/tasks?assignee=me`)
    expect(res.body.tasks.map(t => t.id)).toEqual([mine])
  })
})
