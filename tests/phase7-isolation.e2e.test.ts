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

async function createWorkspace(actor: UserCtx, slug: string): Promise<string> {
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

async function createBoard(actor: UserCtx, wsId: string, slug: string): Promise<BoardCtx> {
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
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title: 'T' } },
  )
  return res.body.task.id
}

describe('phase7 isolation: comments RLS across workspaces', () => {
  it('cannot leak workspace B comments through workspace A URL even for shared user', async () => {
    const u = await registerUser('multi@example.com')
    const otherOwner = await registerUser('other@example.com')
    const wsA = await createWorkspace(u, 'alpha')
    const wsB = await createWorkspace(otherOwner, 'beta')
    await addMember(otherOwner, wsB, 'multi@example.com', 'member')

    const a = await createBoard(u, wsA, 'a-board')
    const b = await createBoard(otherOwner, wsB, 'b-board')
    const taskInB = await createTask(otherOwner, wsB, b.boardId, b.columns.backlog)

    await fetchWithJar(
      otherOwner.jar,
      `/api/workspaces/${wsB}/boards/${b.boardId}/tasks/${taskInB}/comments`,
      { method: 'POST', body: { body: 'secret from B' } },
    )

    // u is in wsA; hits the wsA URL with a taskId from wsB. The workspace
    // gate passes (u is in wsA), but RLS on task_comments hides B's rows.
    const list = await fetchWithJar<{ comments: { body: string }[] }>(
      u.jar,
      `/api/workspaces/${wsA}/boards/${a.boardId}/tasks/${taskInB}/comments`,
    )
    expect(list.status).toBe(200)
    expect(list.body.comments.length).toBe(0)
    expect(list.body.comments.some(c => c.body === 'secret from B')).toBe(false)

    // Posting a comment for a foreign task under wsA tenant context must fail:
    // RLS hides the task, service throws NotFound.
    const post = await fetchWithJar(
      u.jar,
      `/api/workspaces/${wsA}/boards/${a.boardId}/tasks/${taskInB}/comments`,
      { method: 'POST', body: { body: 'inject' } },
    )
    expect(post.status).toBe(404)
  })

  it('non-member of workspace cannot access comments (workspace gate 404)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner, 'closed')
    const { boardId, columns } = await createBoard(owner, wsId, 'main')
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const res = await fetchWithJar(
      stranger.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
    )
    expect(res.status).toBe(404)
  })
})

describe('phase7 isolation: notifications cross-workspace bell', () => {
  it('user in two workspaces sees mentions from both in a single bell feed', async () => {
    const u = await registerUser('multi@example.com')
    const ownerA = await registerUser('ownera@example.com')
    const ownerB = await registerUser('ownerb@example.com')
    const wsA = await createWorkspace(ownerA, 'alpha')
    const wsB = await createWorkspace(ownerB, 'beta')
    await addMember(ownerA, wsA, 'multi@example.com', 'member')
    await addMember(ownerB, wsB, 'multi@example.com', 'member')

    const a = await createBoard(ownerA, wsA, 'a-board')
    const b = await createBoard(ownerB, wsB, 'b-board')
    const taskA = await createTask(ownerA, wsA, a.boardId, a.columns.backlog)
    const taskB = await createTask(ownerB, wsB, b.boardId, b.columns.backlog)

    await fetchWithJar(
      ownerA.jar,
      `/api/workspaces/${wsA}/boards/${a.boardId}/tasks/${taskA}/comments`,
      { method: 'POST', body: { body: `hi @[Multi](${u.id})` } },
    )
    await fetchWithJar(
      ownerB.jar,
      `/api/workspaces/${wsB}/boards/${b.boardId}/tasks/${taskB}/comments`,
      { method: 'POST', body: { body: `hey @[Multi](${u.id})` } },
    )

    const list = await fetchWithJar<{ notifications: { workspaceId: string; type: string }[] }>(
      u.jar,
      '/api/notifications',
    )
    const mentions = list.body.notifications.filter(n => n.type === 'mention')
    expect(mentions.length).toBe(2)
    expect(new Set(mentions.map(m => m.workspaceId))).toEqual(new Set([wsA, wsB]))

    const count = await fetchWithJar<{ count: number }>(u.jar, '/api/notifications/unread-count')
    expect(count.body.count).toBe(2)
  })

  it('mark-all-read scoped to a single workspace clears only that ones unread', async () => {
    const u = await registerUser('multi@example.com')
    const ownerA = await registerUser('ownera@example.com')
    const ownerB = await registerUser('ownerb@example.com')
    const wsA = await createWorkspace(ownerA, 'alpha')
    const wsB = await createWorkspace(ownerB, 'beta')
    await addMember(ownerA, wsA, 'multi@example.com', 'member')
    await addMember(ownerB, wsB, 'multi@example.com', 'member')
    const a = await createBoard(ownerA, wsA, 'a-board')
    const b = await createBoard(ownerB, wsB, 'b-board')
    const taskA = await createTask(ownerA, wsA, a.boardId, a.columns.backlog)
    const taskB = await createTask(ownerB, wsB, b.boardId, b.columns.backlog)
    await fetchWithJar(
      ownerA.jar,
      `/api/workspaces/${wsA}/boards/${a.boardId}/tasks/${taskA}/comments`,
      { method: 'POST', body: { body: `@[Multi](${u.id})` } },
    )
    await fetchWithJar(
      ownerB.jar,
      `/api/workspaces/${wsB}/boards/${b.boardId}/tasks/${taskB}/comments`,
      { method: 'POST', body: { body: `@[Multi](${u.id})` } },
    )

    const res = await fetchWithJar<{ count: number }>(u.jar, '/api/notifications/read-all', {
      method: 'POST',
      body: { workspaceId: wsA },
    })
    expect(res.body.count).toBe(1)

    const unread = await fetchWithJar<{ count: number }>(u.jar, '/api/notifications/unread-count')
    expect(unread.body.count).toBe(1)
  })
})

describe('phase7 isolation: activity feed cross-workspace', () => {
  it('activity for workspace A excludes events from workspace B even for shared user', async () => {
    const u = await registerUser('multi@example.com')
    const ownerB = await registerUser('ownerb@example.com')
    const wsA = await createWorkspace(u, 'alpha')
    const wsB = await createWorkspace(ownerB, 'beta')
    await addMember(ownerB, wsB, 'multi@example.com', 'member')

    const a = await createBoard(u, wsA, 'a-board')
    const b = await createBoard(ownerB, wsB, 'b-board')
    await createTask(u, wsA, a.boardId, a.columns.backlog)
    await createTask(ownerB, wsB, b.boardId, b.columns.backlog)

    const res = await fetchWithJar<{ events: { boardId: string | null }[] }>(
      u.jar,
      `/api/workspaces/${wsA}/activity`,
    )
    expect(res.body.events.length).toBeGreaterThan(0)
    expect(res.body.events.every(e => e.boardId === a.boardId)).toBe(true)
  })
})

describe('phase7 isolation: cascade delete on workspace', () => {
  it('deleting a workspace cleans up its comments and notifications', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner, 'doomed')
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoard(owner, wsId, 'main')
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: `bye @[Dev](${dev.id})` } },
    )

    const sql = getTestSql()
    const before = await sql<{ c: number }[]>`
      SELECT count(*)::int as c FROM task_comments WHERE workspace_id = ${wsId}
    `
    const beforeNotifs = await sql<{ c: number }[]>`
      SELECT count(*)::int as c FROM notifications WHERE workspace_id = ${wsId}
    `
    expect(before[0]!.c).toBe(1)
    expect(beforeNotifs[0]!.c).toBeGreaterThanOrEqual(1)

    await sql.unsafe(`DELETE FROM workspaces WHERE id = '${wsId}'`)

    const after = await sql<{ c: number }[]>`
      SELECT count(*)::int as c FROM task_comments WHERE workspace_id = ${wsId}
    `
    const afterNotifs = await sql<{ c: number }[]>`
      SELECT count(*)::int as c FROM notifications WHERE workspace_id = ${wsId}
    `
    expect(after[0]!.c).toBe(0)
    expect(afterNotifs[0]!.c).toBe(0)
  })
})
