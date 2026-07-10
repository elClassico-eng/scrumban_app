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
    headers: { 'x-forwarded-for': `10.2.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return jar
}

describe('dismissible hints', () => {
  it('me отдаёт пустой список, dismiss добавляет ключ идемпотентно', async () => {
    const jar = await registerUser('hints@example.com')

    const me1 = await fetchWithJar<{ user: { dismissedHints: string[] } }>(jar, '/api/users/me')
    expect(me1.body.user.dismissedHints).toEqual([])

    const d1 = await fetchWithJar<{ dismissedHints: string[] }>(jar, '/api/users/me/dismiss-hint', {
      method: 'POST',
      body: { key: 'simulator-intro' },
    })
    expect(d1.status).toBe(200)
    expect(d1.body.dismissedHints).toEqual(['simulator-intro'])

    const d2 = await fetchWithJar<{ dismissedHints: string[] }>(jar, '/api/users/me/dismiss-hint', {
      method: 'POST',
      body: { key: 'simulator-intro' },
    })
    expect(d2.body.dismissedHints).toEqual(['simulator-intro'])

    const d3 = await fetchWithJar<{ dismissedHints: string[] }>(jar, '/api/users/me/dismiss-hint', {
      method: 'POST',
      body: { key: 'another-hint' },
    })
    expect(d3.body.dismissedHints).toEqual(['simulator-intro', 'another-hint'])

    const me2 = await fetchWithJar<{ user: { dismissedHints: string[] } }>(jar, '/api/users/me')
    expect(me2.body.user.dismissedHints).toEqual(['simulator-intro', 'another-hint'])
  })

  it('401 без авторизации, 400 на пустой ключ', async () => {
    const anon = await fetchWithJar(new CookieJar(), '/api/users/me/dismiss-hint', {
      method: 'POST',
      body: { key: 'x' },
    })
    expect(anon.status).toBe(401)

    const jar = await registerUser('hints2@example.com')
    const bad = await fetchWithJar(jar, '/api/users/me/dismiss-hint', {
      method: 'POST',
      body: { key: '' },
    })
    expect(bad.status).toBe(400)
  })
})
