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
  const lookup = Object.fromEntries(cols.body.columns.map((c) => [c.columnRole, c.id])) as Record<
    'backlog' | 'in_progress' | 'review' | 'done',
    string
  >
  return { boardId: board.body.board.id, columns: lookup }
}

describe('POST /tasks', () => {
  it('member can create a task in Backlog', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar<{
      task: { id: string; title: string; columnId: string; position: number; serviceClass: string }
    }>(dev.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: columns.backlog, title: 'Implement login' },
    })
    expect(res.status).toBe(200)
    expect(res.body.task.title).toBe('Implement login')
    expect(res.body.task.columnId).toBe(columns.backlog)
    expect(res.body.task.position).toBe(0)
    expect(res.body.task.serviceClass).toBe('standard')
  })

  it('positions are appended within a column', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)

    const t1 = await fetchWithJar<{ task: { position: number } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 'first' } },
    )
    const t2 = await fetchWithJar<{ task: { position: number } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 'second' } },
    )
    expect(t1.body.task.position).toBe(0)
    expect(t2.body.task.position).toBe(1)
  })

  it('viewer cannot create a task (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar(
      viewer.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 'nope' } },
    )
    expect(res.status).toBe(403)
  })

  it('rejects empty title (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: '' } },
    )
    expect(res.status).toBe(400)
  })

  it('accepts assigneeId and serviceClass=expedite', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar<{
      task: { assigneeId: string | null; serviceClass: string; expeditedAt: string | null }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: {
        columnId: columns.backlog,
        title: 'Important',
        assigneeId: dev.id,
        serviceClass: 'expedite',
      },
    })
    expect(res.status).toBe(200)
    expect(res.body.task.assigneeId).toBe(dev.id)
    expect(res.body.task.serviceClass).toBe('expedite')
    // Expedite tasks get a stamped expeditedAt — Phase 5 §2.1 rule.
    expect(res.body.task.expeditedAt).not.toBeNull()
  })
})

describe('GET /tasks', () => {
  it('lists tasks ordered by (column, position)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: columns.backlog, title: 'b1' },
    })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: columns.in_progress, title: 'p1' },
    })

    const res = await fetchWithJar<{ tasks: { title: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    )
    expect(res.status).toBe(200)
    expect(res.body.tasks).toHaveLength(2)
  })
})

describe('PATCH /tasks/:taskId', () => {
  it('member can rename and re-classify their tasks', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const created = await fetchWithJar<{ task: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 'old' } },
    )

    const res = await fetchWithJar<{ task: { title: string; serviceClass: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${created.body.task.id}`,
      { method: 'PATCH', body: { title: 'new', serviceClass: 'intangible' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.task.title).toBe('new')
    expect(res.body.task.serviceClass).toBe('intangible')
  })

  it('null assigneeId un-assigns', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const created = await fetchWithJar<{ task: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      {
        method: 'POST',
        body: { columnId: columns.backlog, title: 't', assigneeId: dev.id },
      },
    )

    const res = await fetchWithJar<{ task: { assigneeId: string | null } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${created.body.task.id}`,
      { method: 'PATCH', body: { assigneeId: null } },
    )
    expect(res.status).toBe(200)
    expect(res.body.task.assigneeId).toBeNull()
  })

  it('rejects empty patch body (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const created = await fetchWithJar<{ task: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 't' } },
    )

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${created.body.task.id}`,
      { method: 'PATCH', body: {} },
    )
    expect(res.status).toBe(400)
  })

  it('viewer cannot patch (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const created = await fetchWithJar<{ task: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 't' } },
    )

    const res = await fetchWithJar(
      viewer.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${created.body.task.id}`,
      { method: 'PATCH', body: { title: 'changed' } },
    )
    expect(res.status).toBe(403)
  })
})

describe('DELETE /tasks/:taskId', () => {
  it('admin can delete', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const created = await fetchWithJar<{ task: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 't' } },
    )

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${created.body.task.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)
  })

  it('member cannot delete (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const created = await fetchWithJar<{ task: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: columns.backlog, title: 't' } },
    )

    const res = await fetchWithJar(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${created.body.task.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(403)
  })
})
