// End-to-end tests for /api/workspaces/:id/boards/:boardId/columns.
// Includes the "default 4 columns are seeded on board create" assertion
// and the atomic reorder flow.
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

async function createBoard(actor: UserCtx, wsId: string, slug = 'main'): Promise<string> {
  const res = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: 'Main', slug } },
  )
  return res.body.board.id
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

describe('default columns on board creation', () => {
  it('new board comes with Backlog / In Progress / Review / Done', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)

    const res = await fetchWithJar<{
      columns: { name: string; columnRole: string; position: number }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`)

    expect(res.status).toBe(200)
    expect(res.body.columns).toHaveLength(4)
    expect(res.body.columns.map((c) => c.columnRole)).toEqual([
      'backlog',
      'in_progress',
      'review',
      'done',
    ])
    expect(res.body.columns.map((c) => c.position)).toEqual([0, 1, 2, 3])
  })
})

describe('GET /columns', () => {
  it('viewer can list columns', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    const boardId = await createBoard(owner, wsId)

    const res = await fetchWithJar<{ columns: unknown[] }>(
      viewer.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    expect(res.status).toBe(200)
    expect(res.body.columns).toHaveLength(4)
  })

  it('non-member cannot list (404 on the workspace lookup)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)

    const res = await fetchWithJar(
      stranger.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    expect(res.status).toBe(404)
  })
})

describe('POST /columns', () => {
  it('admin can append a column at the end', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)

    const res = await fetchWithJar<{
      column: { name: string; position: number; wipLimit: number | null }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`, {
      method: 'POST',
      body: { name: 'Blocked', columnRole: 'archived', wipLimit: 5 },
    })
    expect(res.status).toBe(200)
    expect(res.body.column.name).toBe('Blocked')
    expect(res.body.column.position).toBe(4) // appended after default 0..3
    expect(res.body.column.wipLimit).toBe(5)
  })

  it('member cannot create a column (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'guest@example.com', 'member')
    const boardId = await createBoard(owner, wsId)

    const res = await fetchWithJar(
      guest.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
      { method: 'POST', body: { name: 'X', columnRole: 'archived' } },
    )
    expect(res.status).toBe(403)
  })

  it('rejects invalid columnRole (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
      { method: 'POST', body: { name: 'X', columnRole: 'invented' } },
    )
    expect(res.status).toBe(400)
  })
})

describe('PATCH /columns/:columnId', () => {
  it('admin can rename and set wipLimit', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)

    const list = await fetchWithJar<{
      columns: { id: string; columnRole: string }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`)
    const wip = list.body.columns.find((c) => c.columnRole === 'in_progress')!

    const res = await fetchWithJar<{ column: { name: string; wipLimit: number } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${wip.id}`,
      { method: 'PATCH', body: { name: 'Doing', wipLimit: 3 } },
    )
    expect(res.status).toBe(200)
    expect(res.body.column.name).toBe('Doing')
    expect(res.body.column.wipLimit).toBe(3)
  })

  it('explicit null wipLimit removes the cap', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const list = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    const wip = list.body.columns.find((c) => c.columnRole === 'in_progress')!
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${wip.id}`,
      { method: 'PATCH', body: { wipLimit: 5 } },
    )

    const res = await fetchWithJar<{ column: { wipLimit: number | null } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${wip.id}`,
      { method: 'PATCH', body: { wipLimit: null } },
    )
    expect(res.status).toBe(200)
    expect(res.body.column.wipLimit).toBeNull()
  })

  it('rejects empty patch body (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const list = await fetchWithJar<{ columns: { id: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    const colId = list.body.columns[0]!.id

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${colId}`,
      { method: 'PATCH', body: {} },
    )
    expect(res.status).toBe(400)
  })
})

describe('DELETE /columns/:columnId', () => {
  it('admin can delete an empty column', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const list = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    const target = list.body.columns.find((c) => c.columnRole === 'review')!

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${target.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)
  })

  it('member cannot delete a column (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'guest@example.com', 'member')
    const boardId = await createBoard(owner, wsId)
    const list = await fetchWithJar<{ columns: { id: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    const colId = list.body.columns[0]!.id

    const res = await fetchWithJar(
      guest.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${colId}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /columns/reorder', () => {
  it('reorders columns to match supplied order', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const list = await fetchWithJar<{
      columns: { id: string; columnRole: string }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`)
    const byRole = Object.fromEntries(
      list.body.columns.map((c) => [c.columnRole, c.id]),
    )

    // Reverse the default order: done → review → in_progress → backlog
    const desired = [byRole.done, byRole.review, byRole.in_progress, byRole.backlog]

    const res = await fetchWithJar<{
      columns: { id: string; position: number }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns/reorder`, {
      method: 'POST',
      body: { orderedIds: desired },
    })
    expect(res.status).toBe(200)
    expect(res.body.columns.map((c) => c.id)).toEqual(desired)
    expect(res.body.columns.map((c) => c.position)).toEqual([0, 1, 2, 3])
  })

  it('rejects partial id list (422)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const list = await fetchWithJar<{ columns: { id: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/reorder`,
      { method: 'POST', body: { orderedIds: [list.body.columns[0]!.id] } },
    )
    expect(res.status).toBe(422)
  })

  it('rejects unknown column id (422)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const list = await fetchWithJar<{ columns: { id: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    const ids = list.body.columns.map((c) => c.id)
    // Replace last with a stranger UUID — same length, fails the membership check.
    ids[ids.length - 1] = '00000000-0000-0000-0000-000000000000'

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/reorder`,
      { method: 'POST', body: { orderedIds: ids } },
    )
    expect(res.status).toBe(422)
  })
})
