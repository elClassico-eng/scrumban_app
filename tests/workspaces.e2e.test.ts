// End-to-end tests for /api/workspaces. Includes a cross-user isolation
// test that asserts user B cannot see workspaces user A created (and the
// 404-vs-403 distinction is intentionally absent — see the service for why).
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

async function registerAndLogin(email: string): Promise<CookieJar> {
  const jar = new CookieJar()
  await fetchWithJar(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'correct horse battery 1',
      workspace: { name: 'Reg WS', slug: 'reg-ws' },
    },
    headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return jar
}

describe('POST /api/workspaces', () => {
  it('creates a workspace with the current user as Owner', async () => {
    const jar = await registerAndLogin('alice@example.com')
    const res = await fetchWithJar<{
      workspace: { id: string; slug: string; role: string }
    }>(jar, '/api/workspaces', {
      method: 'POST',
      body: { name: 'Acme Corp', slug: 'acme' },
    })
    expect(res.status).toBe(200)
    expect(res.body.workspace.slug).toBe('acme')
    expect(res.body.workspace.role).toBe('owner')
  })

  it('allows duplicate slug (global uniqueness dropped in 0023)', async () => {
    const jar = await registerAndLogin('alice@example.com')
    await fetchWithJar(jar, '/api/workspaces', {
      method: 'POST',
      body: { name: 'Acme', slug: 'acme' },
    })
    const res = await fetchWithJar<{ workspace: { slug: string } }>(jar, '/api/workspaces', {
      method: 'POST',
      body: { name: 'Other', slug: 'acme' },
    })
    expect(res.status).toBe(200)
    expect(res.body.workspace.slug).toBe('acme')
  })

  it('rejects bad slug format with 400', async () => {
    const jar = await registerAndLogin('alice@example.com')
    const res = await fetchWithJar(jar, '/api/workspaces', {
      method: 'POST',
      body: { name: 'Acme', slug: '-invalid-' },
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await fetchWithJar(new CookieJar(), '/api/workspaces', {
      method: 'POST',
      body: { name: 'Acme', slug: 'acme' },
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/workspaces', () => {
  it('returns only workspaces the user is a member of', async () => {
    const alice = await registerAndLogin('alice@example.com')
    const bob = await registerAndLogin('bob@example.com')

    await fetchWithJar(alice, '/api/workspaces', {
      method: 'POST',
      body: { name: 'Acme', slug: 'acme' },
    })

    const aliceList = await fetchWithJar<{ workspaces: { slug: string }[] }>(
      alice,
      '/api/workspaces',
    )
    expect(aliceList.body.workspaces).toHaveLength(2)
    expect(aliceList.body.workspaces.map(w => w.slug)).toContain('acme')

    const bobList = await fetchWithJar<{ workspaces: { slug: string }[] }>(bob, '/api/workspaces')
    expect(bobList.body.workspaces).toHaveLength(1)
    expect(bobList.body.workspaces.map(w => w.slug)).not.toContain('acme')
  })
})

describe('GET /api/workspaces/:id', () => {
  it('returns workspace + role for a member', async () => {
    const alice = await registerAndLogin('alice@example.com')
    const created = await fetchWithJar<{ workspace: { id: string } }>(
      alice,
      '/api/workspaces',
      { method: 'POST', body: { name: 'Acme', slug: 'acme' } },
    )

    const res = await fetchWithJar<{ workspace: { slug: string; role: string } }>(
      alice,
      `/api/workspaces/${created.body.workspace.id}`,
    )
    expect(res.status).toBe(200)
    expect(res.body.workspace.slug).toBe('acme')
    expect(res.body.workspace.role).toBe('owner')
  })

  it('returns 404 (not 403) when user is not a member', async () => {
    const alice = await registerAndLogin('alice@example.com')
    const bob = await registerAndLogin('bob@example.com')
    const created = await fetchWithJar<{ workspace: { id: string } }>(
      alice,
      '/api/workspaces',
      { method: 'POST', body: { name: 'Acme', slug: 'acme' } },
    )

    const res = await fetchWithJar(bob, `/api/workspaces/${created.body.workspace.id}`)
    expect(res.status).toBe(404)
  })

  it('returns 400 on malformed UUID', async () => {
    const alice = await registerAndLogin('alice@example.com')
    const res = await fetchWithJar(alice, '/api/workspaces/not-a-uuid')
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await fetchWithJar(new CookieJar(), '/api/workspaces/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/workspaces/:id', () => {
  it('owner can rename the workspace; slug stays read-only', async () => {
    const alice = await registerAndLogin('alice@example.com')
    const created = await fetchWithJar<{ workspace: { id: string; slug: string } }>(
      alice,
      '/api/workspaces',
      { method: 'POST', body: { name: 'Acme', slug: 'acme' } },
    )

    const res = await fetchWithJar<{ workspace: { name: string; slug: string; role: string } }>(
      alice,
      `/api/workspaces/${created.body.workspace.id}`,
      { method: 'PATCH', body: { name: 'Acme Corp' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.workspace.name).toBe('Acme Corp')
    expect(res.body.workspace.slug).toBe('acme')
    expect(res.body.workspace.role).toBe('owner')
  })

  it('non-admin member cannot rename the workspace', async () => {
    const alice = await registerAndLogin('alice@example.com')
    const bob = await registerAndLogin('bob@example.com')
    const created = await fetchWithJar<{ workspace: { id: string } }>(
      alice,
      '/api/workspaces',
      { method: 'POST', body: { name: 'Acme', slug: 'acme' } },
    )
    await fetchWithJar(alice, `/api/workspaces/${created.body.workspace.id}/members`, {
      method: 'POST',
      body: { email: 'bob@example.com', role: 'member' },
    })

    const res = await fetchWithJar(bob, `/api/workspaces/${created.body.workspace.id}`, {
      method: 'PATCH',
      body: { name: 'Hacked' },
    })
    expect(res.status).toBe(403)
  })
})
