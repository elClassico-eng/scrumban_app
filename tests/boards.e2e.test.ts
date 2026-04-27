// End-to-end tests for /api/workspaces/:id/boards.
// Verifies CRUD happy paths, RBAC matrix, slug uniqueness within a
// workspace, and tenant isolation through the HTTP surface (which
// rides on top of the RLS isolation tested in rls.integration.test.ts).
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

describe('POST /api/workspaces/:id/boards', () => {
  it('owner can create a board', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar<{ board: { id: string; name: string; slug: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Sprint Board', slug: 'sprint' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.board.slug).toBe('sprint')
    expect(res.body.board.name).toBe('Sprint Board')
  })

  it('admin can create a board', async () => {
    const owner = await registerUser('owner@example.com')
    const adm = await registerUser('admin@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'admin@example.com', 'admin')

    const res = await fetchWithJar(adm.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'Admin Board', slug: 'admin-board' },
    })
    expect(res.status).toBe(200)
  })

  it('member cannot create a board (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'guest@example.com', 'member')

    const res = await fetchWithJar(guest.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'Nope', slug: 'nope' },
    })
    expect(res.status).toBe(403)
  })

  it('rejects duplicate slug within the same workspace (409)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'A', slug: 'main' },
    })
    const res = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'B', slug: 'main' },
    })
    expect(res.status).toBe(409)
  })

  it('allows the same slug across different workspaces', async () => {
    const owner = await registerUser('owner@example.com')
    const wsA = await createWorkspace(owner, 'alpha')
    const wsB = await createWorkspace(owner, 'beta')

    const ra = await fetchWithJar(owner.jar, `/api/workspaces/${wsA}/boards`, {
      method: 'POST',
      body: { name: 'Main', slug: 'main' },
    })
    const rb = await fetchWithJar(owner.jar, `/api/workspaces/${wsB}/boards`, {
      method: 'POST',
      body: { name: 'Main', slug: 'main' },
    })
    expect(ra.status).toBe(200)
    expect(rb.status).toBe(200)
  })

  it('rejects bad slug format (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const res = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'X', slug: '-bad-' },
    })
    expect(res.status).toBe(400)
  })

  it('non-member gets 404 (no leak)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar(stranger.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'Demo', slug: 'demo' },
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/workspaces/:id/boards', () => {
  it('viewer can list boards', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'Main', slug: 'main' },
    })

    const res = await fetchWithJar<{ boards: { slug: string }[] }>(
      viewer.jar,
      `/api/workspaces/${wsId}/boards`,
    )
    expect(res.status).toBe(200)
    expect(res.body.boards).toHaveLength(1)
    expect(res.body.boards[0]!.slug).toBe('main')
  })

  it('returns empty list when no boards', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar<{ boards: unknown[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
    )
    expect(res.body.boards).toHaveLength(0)
  })
})

describe('GET /api/workspaces/:id/boards/:boardId', () => {
  it('returns the requested board', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const created = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Main', slug: 'main' } },
    )

    const res = await fetchWithJar<{ board: { slug: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${created.body.board.id}`,
    )
    expect(res.status).toBe(200)
    expect(res.body.board.slug).toBe('main')
  })

  it('returns 404 for unknown board id', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/00000000-0000-0000-0000-000000000000`,
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 on malformed UUID', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const res = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/not-a-uuid`)
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/workspaces/:id/boards/:boardId', () => {
  it('admin can rename a board', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const created = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Old', slug: 'old' } },
    )

    const res = await fetchWithJar<{ board: { name: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${created.body.board.id}`,
      { method: 'PATCH', body: { name: 'New' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.board.name).toBe('New')
  })

  it('member cannot rename a board (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'guest@example.com', 'member')
    const created = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Old', slug: 'old' } },
    )

    const res = await fetchWithJar(
      guest.jar,
      `/api/workspaces/${wsId}/boards/${created.body.board.id}`,
      { method: 'PATCH', body: { name: 'New' } },
    )
    expect(res.status).toBe(403)
  })

  it('rejects empty patch body (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const created = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Demo', slug: 'demo' } },
    )

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${created.body.board.id}`,
      { method: 'PATCH', body: {} },
    )
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/workspaces/:id/boards/:boardId', () => {
  it('owner can delete a board', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const created = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Demo', slug: 'demo' } },
    )

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${created.body.board.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)
  })

  it('admin cannot delete a board (403, owner-only)', async () => {
    const owner = await registerUser('owner@example.com')
    const adm = await registerUser('admin@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'admin@example.com', 'admin')
    const created = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Demo', slug: 'demo' } },
    )

    const res = await fetchWithJar(
      adm.jar,
      `/api/workspaces/${wsId}/boards/${created.body.board.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(403)
  })
})
