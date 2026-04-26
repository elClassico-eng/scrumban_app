// End-to-end tests for /api/workspaces/:id/members. Covers RBAC matrix:
// who can list / add / promote / demote / remove whom, and the special
// "last remaining owner" guard.
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

describe('GET /api/workspaces/:id/members', () => {
  it('owner sees themselves in the roster', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar<{ members: { email: string; role: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/members`,
    )
    expect(res.status).toBe(200)
    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0]!.email).toBe('owner@example.com')
    expect(res.body.members[0]!.role).toBe('owner')
  })

  it('non-member gets 404 (no leak)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar(stranger.jar, `/api/workspaces/${wsId}/members`)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/workspaces/:id/members', () => {
  it('owner can add a registered user as member', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar<{ member: { email: string; role: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/members`,
      { method: 'POST', body: { email: 'guest@example.com', role: 'member' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.member.email).toBe('guest@example.com')
    expect(res.body.member.role).toBe('member')
    void guest
  })

  it('returns 404 when email is not registered', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/members`,
      { method: 'POST', body: { email: 'nobody@example.com', role: 'member' } },
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when user is already a member', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'guest@example.com', role: 'member' },
    })

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/members`,
      { method: 'POST', body: { email: 'guest@example.com', role: 'admin' } },
    )
    expect(res.status).toBe(409)
    void guest
  })

  it('non-admin member cannot add others (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const newcomer = await registerUser('newcomer@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'guest@example.com', role: 'member' },
    })

    const res = await fetchWithJar(
      guest.jar,
      `/api/workspaces/${wsId}/members`,
      { method: 'POST', body: { email: 'newcomer@example.com', role: 'member' } },
    )
    expect(res.status).toBe(403)
    void newcomer
  })

  it('admin cannot grant owner (must strictly outrank)', async () => {
    const owner = await registerUser('owner@example.com')
    const newAdmin = await registerUser('admin@example.com')
    const candidate = await registerUser('candidate@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'admin@example.com', role: 'admin' },
    })

    const res = await fetchWithJar(newAdmin.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'candidate@example.com', role: 'owner' },
    })
    expect(res.status).toBe(403)
    void candidate
  })
})

describe('PATCH /api/workspaces/:id/members/:userId', () => {
  it('owner can promote a member to admin', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'guest@example.com', role: 'member' },
    })

    const res = await fetchWithJar<{ member: { role: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/members/${guest.id}`,
      { method: 'PATCH', body: { role: 'admin' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.member.role).toBe('admin')
  })

  it('admin cannot demote owner', async () => {
    const owner = await registerUser('owner@example.com')
    const admin = await registerUser('admin@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'admin@example.com', role: 'admin' },
    })

    const res = await fetchWithJar(
      admin.jar,
      `/api/workspaces/${wsId}/members/${owner.id}`,
      { method: 'PATCH', body: { role: 'member' } },
    )
    expect(res.status).toBe(403)
  })

  it('cannot demote the last remaining owner', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/members/${owner.id}`,
      { method: 'PATCH', body: { role: 'admin' } },
    )
    expect(res.status).toBe(422)
  })
})

describe('DELETE /api/workspaces/:id/members/:userId', () => {
  it('owner can remove a member', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'guest@example.com', role: 'member' },
    })

    const del = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/members/${guest.id}`,
      { method: 'DELETE' },
    )
    expect(del.status).toBe(204)

    const list = await fetchWithJar<{ members: unknown[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/members`,
    )
    expect(list.body.members).toHaveLength(1)
  })

  it('member can remove themselves', async () => {
    const owner = await registerUser('owner@example.com')
    const guest = await registerUser('guest@example.com')
    const wsId = await createWorkspace(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'guest@example.com', role: 'member' },
    })

    const res = await fetchWithJar(
      guest.jar,
      `/api/workspaces/${wsId}/members/${guest.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)
  })

  it('cannot remove the last remaining owner', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/members/${owner.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(422)
  })
})
