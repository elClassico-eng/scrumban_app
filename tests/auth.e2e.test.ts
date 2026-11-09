// End-to-end tests for /api/auth/* — boots a real Nuxt instance via
// @nuxt/test-utils, hits the HTTP endpoints, asserts on status + body.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'

// Point the booted Nuxt at the test database.
process.env.DATABASE_URL = TEST_URL

await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

const credentials = {
  email: 'alice@example.com',
  password: 'correct horse battery 1',
  workspace: { name: 'Alice WS', slug: 'alice-ws' },
}

function uniqueIp(): Record<string, string> {
  return { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` }
}

describe('POST /api/auth/register', () => {
  it('creates a user, starts a session, returns the public user', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar<{ user: { id: string; email: string } }>(
      jar,
      '/api/auth/register',
      { method: 'POST', body: credentials, headers: uniqueIp() },
    )

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(credentials.email)
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(jar.header).toContain('nuxt-session=')
  })

  it('rejects malformed email with 400', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar(jar, '/api/auth/register', {
      method: 'POST',
      body: { ...credentials, email: 'not-an-email' },
      headers: uniqueIp(),
    })
    expect(res.status).toBe(400)
  })

  it('rejects short password with 400', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar(jar, '/api/auth/register', {
      method: 'POST',
      body: { ...credentials, password: 'short' },
      headers: uniqueIp(),
    })
    expect(res.status).toBe(400)
  })

  it('rejects duplicate email with 409', async () => {
    const jar = new CookieJar()
    await fetchWithJar(jar, '/api/auth/register', { method: 'POST', body: credentials, headers: uniqueIp() })
    const res = await fetchWithJar(new CookieJar(), '/api/auth/register', {
      method: 'POST',
      body: credentials,
      headers: uniqueIp(),
    })
    expect(res.status).toBe(409)
  })

  it('treats email as case-insensitive on duplicate check', async () => {
    const jar = new CookieJar()
    await fetchWithJar(jar, '/api/auth/register', { method: 'POST', body: credentials, headers: uniqueIp() })
    const res = await fetchWithJar(new CookieJar(), '/api/auth/register', {
      method: 'POST',
      body: { ...credentials, email: credentials.email.toUpperCase() },
      headers: uniqueIp(),
    })
    expect(res.status).toBe(409)
  })

  it('registers without a workspace', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar<{ workspace: unknown }>(jar, '/api/auth/register', {
      method: 'POST',
      body: { email: 'solo@example.com', password: credentials.password },
      headers: uniqueIp(),
    })
    expect(res.status).toBe(200)
    expect(res.body.workspace).toBeNull()

    const list = await fetchWithJar<{ workspaces: unknown[] }>(jar, '/api/workspaces')
    expect(list.status).toBe(200)
    expect(list.body.workspaces).toHaveLength(0)
  })

  it('invited user registers without a workspace and accepts the invite', async () => {
    const owner = new CookieJar()
    const ownerRes = await fetchWithJar<{ workspace: { id: string } }>(owner, '/api/auth/register', {
      method: 'POST',
      body: credentials,
      headers: uniqueIp(),
    })
    const invite = await fetchWithJar<{ token: string }>(owner, `/api/workspaces/${ownerRes.body.workspace.id}/invitations`, {
      method: 'POST',
      body: { role: 'member' },
    })
    expect(invite.status).toBe(200)

    const invitee = new CookieJar()
    const reg = await fetchWithJar(invitee, '/api/auth/register', {
      method: 'POST',
      body: { email: 'invitee@example.com', password: credentials.password },
      headers: uniqueIp(),
    })
    expect(reg.status).toBe(200)

    const accept = await fetchWithJar(invitee, `/api/invitations/${invite.body.token}/accept`, { method: 'POST' })
    expect(accept.status).toBe(200)

    const list = await fetchWithJar<{ workspaces: Array<{ id: string }> }>(invitee, '/api/workspaces')
    expect(list.body.workspaces.map(w => w.id)).toEqual([ownerRes.body.workspace.id])
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await fetchWithJar(new CookieJar(), '/api/auth/register', {
      method: 'POST',
      body: credentials,
      headers: uniqueIp(),
    })
  })

  it('returns 200 + session cookie on correct credentials', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar<{ user: { email: string } }>(jar, '/api/auth/login', {
      method: 'POST',
      body: credentials,
      headers: uniqueIp(),
    })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(credentials.email)
    expect(jar.header).toContain('nuxt-session=')
  })

  it('returns 401 on wrong password', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar(jar, '/api/auth/login', {
      method: 'POST',
      body: { ...credentials, password: 'wrong' },
      headers: uniqueIp(),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 on unknown email (no enumeration leak)', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar(jar, '/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: credentials.password },
      headers: uniqueIp(),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/session', () => {
  it('returns the current user when authenticated', async () => {
    const jar = new CookieJar()
    await fetchWithJar(jar, '/api/auth/register', { method: 'POST', body: credentials, headers: uniqueIp() })
    const res = await fetchWithJar<{ user: { email: string } }>(jar, '/api/auth/session')
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(credentials.email)
  })

  it('returns 401 without a session cookie', async () => {
    const jar = new CookieJar()
    const res = await fetchWithJar(jar, '/api/auth/session')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session so subsequent /session returns 401', async () => {
    const jar = new CookieJar()
    await fetchWithJar(jar, '/api/auth/register', { method: 'POST', body: credentials, headers: uniqueIp() })

    const logout = await fetchWithJar<{ ok: boolean }>(jar, '/api/auth/logout', { method: 'POST' })
    expect(logout.status).toBe(200)
    expect(logout.body.ok).toBe(true)

    const session = await fetchWithJar(jar, '/api/auth/session')
    expect(session.status).toBe(401)
  })
})

describe('personal data consent', () => {
  type Session = { user: { personalDataConsentAt: string | null } }

  async function register(body: Record<string, unknown>) {
    const jar = new CookieJar()
    const res = await fetchWithJar(jar, '/api/auth/register', {
      method: 'POST',
      body: { email: 'consent@example.com', password: credentials.password, ...body },
      headers: uniqueIp(),
    })
    return { jar, status: res.status }
  }

  it('register with consent stores the consent time', async () => {
    const { jar, status } = await register({ consent: true })
    expect(status).toBe(200)
    const session = await fetchWithJar<Session>(jar, '/api/auth/session')
    expect(session.body.user.personalDataConsentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('register without consent leaves it null', async () => {
    const { jar } = await register({})
    const session = await fetchWithJar<Session>(jar, '/api/auth/session')
    expect(session.body.user.personalDataConsentAt).toBeNull()
  })

  it('rejects consent: false', async () => {
    const { status } = await register({ consent: false })
    expect(status).toBe(400)
  })

  it('POST /api/users/me/consent sets the time', async () => {
    const { jar } = await register({})
    const res = await fetchWithJar(jar, '/api/users/me/consent', { method: 'POST' })
    expect(res.status).toBe(204)
    const session = await fetchWithJar<Session>(jar, '/api/auth/session')
    expect(session.body.user.personalDataConsentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('POST /api/users/me/consent requires a session', async () => {
    const res = await fetchWithJar(new CookieJar(), '/api/users/me/consent', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
