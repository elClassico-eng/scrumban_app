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

async function createTask(actor: UserCtx, wsId: string, boardId: string, columnId: string): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title: 'T' } },
  )
  return res.body.task.id
}

describe('POST /comments', () => {
  it('member can create a comment', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const res = await fetchWithJar<{
      comment: { id: string; body: string; author: { id: string } | null }
    }>(dev.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { body: 'Looks good to me' },
    })
    expect(res.status).toBe(200)
    expect(res.body.comment.body).toBe('Looks good to me')
    expect(res.body.comment.author?.id).toBe(dev.id)
  })

  it('rejects empty body (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: '   ' } },
    )
    expect([400, 422]).toContain(res.status)
  })

  it('viewer cannot comment (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const res = await fetchWithJar(
      viewer.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'silenced' } },
    )
    expect(res.status).toBe(403)
  })

  it('parses workspace-member mentions and drops outsiders', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const outsider = await registerUser('outsider@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const body = `hey @[Dev](${dev.id}) and @[Outsider](${outsider.id}) please review`
    const res = await fetchWithJar<{ comment: { mentionedUserIds: string[] } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body } },
    )
    expect(res.status).toBe(200)
    expect(res.body.comment.mentionedUserIds).toContain(dev.id)
    expect(res.body.comment.mentionedUserIds).not.toContain(outsider.id)
  })
})

describe('GET /comments', () => {
  it('returns comments ordered by created_at asc with author info', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'first' } },
    )
    await fetchWithJar(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'second' } },
    )

    const res = await fetchWithJar<{ comments: { body: string; author: { id: string } | null }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
    )
    expect(res.status).toBe(200)
    expect(res.body.comments.map(c => c.body)).toEqual(['first', 'second'])
    expect(res.body.comments[1]!.author?.id).toBe(dev.id)
  })

  it('writes a task_commented event on create', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'audit-me' } },
    )

    const sql = getTestSql()
    const rows = await sql<{ event_type: string; actor_id: string; payload: unknown }[]>`
      SELECT event_type, actor_id, payload FROM task_events
       WHERE task_id = ${taskId} AND event_type = 'task_commented'
    `
    expect(rows.length).toBe(1)
    expect(rows[0]!.actor_id).toBe(owner.id)
  })
})

describe('PATCH /comments/:id', () => {
  it('author can edit within 5 minutes', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const created = await fetchWithJar<{ comment: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'first draft' } },
    )
    const commentId = created.body.comment.id

    const res = await fetchWithJar<{ comment: { body: string; editedAt: string | null } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
      { method: 'PATCH', body: { body: 'updated' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.comment.body).toBe('updated')
    expect(res.body.comment.editedAt).not.toBeNull()
  })

  it('author with role=member cannot edit after 5 minute window (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const created = await fetchWithJar<{ comment: { id: string } }>(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'old comment' } },
    )
    const commentId = created.body.comment.id

    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE task_comments SET created_at = now() - interval '10 minutes' WHERE id = '${commentId}'`,
    )

    const res = await fetchWithJar(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
      { method: 'PATCH', body: { body: 'too late' } },
    )
    expect(res.status).toBe(403)
  })

  it('admin can edit any comment any time', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const created = await fetchWithJar<{ comment: { id: string } }>(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'dev wrote this' } },
    )
    const commentId = created.body.comment.id

    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE task_comments SET created_at = now() - interval '1 hour' WHERE id = '${commentId}'`,
    )

    const res = await fetchWithJar<{ comment: { body: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
      { method: 'PATCH', body: { body: 'edited by admin' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.comment.body).toBe('edited by admin')
  })
})

describe('DELETE /comments/:id', () => {
  it('author can delete own comment', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const created = await fetchWithJar<{ comment: { id: string } }>(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'mine' } },
    )
    const commentId = created.body.comment.id

    const res = await fetchWithJar(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(200)

    const list = await fetchWithJar<{ comments: { id: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
    )
    expect(list.body.comments.find(c => c.id === commentId)).toBeUndefined()
  })

  it('non-author non-admin cannot delete (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const other = await registerUser('other@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    await addMember(owner, wsId, 'other@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const created = await fetchWithJar<{ comment: { id: string } }>(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'dev wrote this' } },
    )
    const commentId = created.body.comment.id

    const res = await fetchWithJar(
      other.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(403)
  })

  it('admin can delete any comment + writes task_comment_deleted event', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)

    const created = await fetchWithJar<{ comment: { id: string } }>(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { body: 'will be removed' } },
    )
    const commentId = created.body.comment.id

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments/${commentId}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(200)

    const sql = getTestSql()
    const rows = await sql<{ event_type: string; actor_id: string }[]>`
      SELECT event_type, actor_id FROM task_events
       WHERE task_id = ${taskId} AND event_type = 'task_comment_deleted'
    `
    expect(rows.length).toBe(1)
    expect(rows[0]!.actor_id).toBe(owner.id)
  })
})
