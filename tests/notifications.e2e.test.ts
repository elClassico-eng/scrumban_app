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
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title: 'T', ...extra } },
  )
  return res.body.task.id
}

describe('notifications: emit on mention', () => {
  it('mention in a comment creates a notification for the mentioned user', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `hi @[Dev](${dev.id})` } },
    )

    const res = await fetchWithJar<{ notifications: { type: string; payload: { taskId: string } }[] }>(
      dev.jar,
      '/api/notifications',
    )
    expect(res.status).toBe(200)
    expect(res.body.notifications.length).toBe(1)
    expect(res.body.notifications[0]!.type).toBe('mention')
    expect(res.body.notifications[0]!.payload.taskId).toBe(taskId)
  })

  it('self-mention does not create a notification', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `note to self @[Owner](${owner.id})` } },
    )

    const res = await fetchWithJar<{ notifications: unknown[] }>(owner.jar, '/api/notifications')
    expect(res.body.notifications.length).toBe(0)
  })
})

describe('notifications: comment_on_assigned', () => {
  it('comment on a task with assignee notifies the assignee', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog, {
      assigneeId: dev.id,
    })

    // Owner comments on dev's task. Dev should see the assigned-notif (from
    // task creation) plus a comment_on_assigned (from the comment).
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'looks good' } },
    )

    const res = await fetchWithJar<{ notifications: { type: string }[] }>(
      dev.jar,
      '/api/notifications',
    )
    const types = res.body.notifications.map(n => n.type)
    expect(types).toContain('assigned')
    expect(types).toContain('comment_on_assigned')
  })

  it('assignee commenting on own task does not notify themselves', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog, {
      assigneeId: owner.id,
    })

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'note to self' } },
    )

    const res = await fetchWithJar<{ notifications: unknown[] }>(owner.jar, '/api/notifications')
    expect(res.body.notifications.length).toBe(0)
  })

  it('mention does not double up with comment_on_assigned', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog, {
      assigneeId: dev.id,
    })

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `@[Dev](${dev.id}) please check` } },
    )

    const res = await fetchWithJar<{ notifications: { type: string }[] }>(
      dev.jar,
      '/api/notifications',
    )
    const types = res.body.notifications.map(n => n.type)
    expect(types.filter(t => t === 'mention').length).toBe(1)
    expect(types.filter(t => t === 'comment_on_assigned').length).toBe(0)
  })
})

describe('notifications: emit on assign', () => {
  it('changing assignee notifies the new assignee', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}`,
      { method: 'PATCH', body: { assigneeId: dev.id } },
    )

    const res = await fetchWithJar<{ notifications: { type: string }[] }>(
      dev.jar,
      '/api/notifications',
    )
    expect(res.body.notifications.map(n => n.type)).toContain('assigned')
  })
})

describe('notifications: list / mark read', () => {
  it('unread filter excludes read rows', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `@[Dev](${dev.id})` } },
    )

    const list = await fetchWithJar<{ notifications: { id: string }[] }>(dev.jar, '/api/notifications')
    const id = list.body.notifications[0]!.id

    const markRes = await fetchWithJar(dev.jar, `/api/notifications/${id}/read`, { method: 'PATCH' })
    expect(markRes.status).toBe(200)

    const unread = await fetchWithJar<{ notifications: unknown[] }>(dev.jar, '/api/notifications?unread=true')
    expect(unread.body.notifications.length).toBe(0)

    const all = await fetchWithJar<{ notifications: unknown[] }>(dev.jar, '/api/notifications')
    expect(all.body.notifications.length).toBe(1)
  })

  it('unread-count reports only unread items', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `@[Dev](${dev.id})` } },
    )
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `again @[Dev](${dev.id})` } },
    )

    const res = await fetchWithJar<{ count: number }>(dev.jar, '/api/notifications/unread-count')
    expect(res.body.count).toBe(2)
  })

  it('mark all read clears unread for the calling user', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `@[Dev](${dev.id})` } },
    )

    const res = await fetchWithJar<{ count: number }>(dev.jar, '/api/notifications/read-all', {
      method: 'POST',
      body: {},
    })
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)

    const unread = await fetchWithJar<{ count: number }>(dev.jar, '/api/notifications/unread-count')
    expect(unread.body.count).toBe(0)
  })

  it('user A cannot mark user B notification as read (404)', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `@[Dev](${dev.id})` } },
    )

    const list = await fetchWithJar<{ notifications: { id: string }[] }>(dev.jar, '/api/notifications')
    const id = list.body.notifications[0]!.id

    const res = await fetchWithJar(stranger.jar, `/api/notifications/${id}/read`, { method: 'PATCH' })
    expect(res.status).toBe(404)
  })

  it('stranger cannot see other users notifications', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `@[Dev](${dev.id})` } },
    )

    const res = await fetchWithJar<{ notifications: unknown[] }>(stranger.jar, '/api/notifications')
    expect(res.body.notifications.length).toBe(0)
  })
})