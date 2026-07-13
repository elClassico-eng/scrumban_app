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

async function registerUser(email: string): Promise<CookieJar> {
  const jar = new CookieJar()
  await fetchWithJar(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'correct horse battery 1',
      workspace: { name: 'Reg WS', slug: 'reg-ws' },
    },
    headers: { 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return jar
}

describe('changelog seen marker', () => {
  it('me отдаёт null, POST проставляет метку, повтор идемпотентен', async () => {
    const jar = await registerUser('changelog@example.com')

    const me1 = await fetchWithJar<{ user: { changelogSeenAt: string | null } }>(jar, '/api/users/me')
    expect(me1.body.user.changelogSeenAt).toBeNull()

    const r1 = await fetchWithJar<{ changelogSeenAt: string }>(jar, '/api/users/me/changelog-seen', {
      method: 'POST',
    })
    expect(r1.status).toBe(200)
    expect(typeof r1.body.changelogSeenAt).toBe('string')

    const me2 = await fetchWithJar<{ user: { changelogSeenAt: string | null } }>(jar, '/api/users/me')
    expect(me2.body.user.changelogSeenAt).toBe(r1.body.changelogSeenAt)

    const r2 = await fetchWithJar<{ changelogSeenAt: string }>(jar, '/api/users/me/changelog-seen', {
      method: 'POST',
    })
    expect(new Date(r2.body.changelogSeenAt).getTime()).toBeGreaterThanOrEqual(
      new Date(r1.body.changelogSeenAt).getTime(),
    )
  })

  it('требует аутентификации (401)', async () => {
    const anon = await fetchWithJar(new CookieJar(), '/api/users/me/changelog-seen', {
      method: 'POST',
    })
    expect(anon.status).toBe(401)
  })
})
