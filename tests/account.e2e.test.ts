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

const PASSWORD = 'correct horse battery 1'

function ip(): Record<string, string> {
  return { 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` }
}

async function registerUser(email: string): Promise<{ jar: CookieJar; id: string }> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: PASSWORD,
      workspace: { name: 'Reg WS', slug: 'reg-ws' },
    },
    headers: ip(),
  })
  return { jar, id: res.body.user.id }
}

async function login(email: string): Promise<CookieJar> {
  const jar = new CookieJar()
  await fetchWithJar(jar, '/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
    headers: ip(),
  })
  return jar
}

describe('активные сессии', () => {
  it('отзывает все сессии кроме текущей', async () => {
    const { jar: first } = await registerUser('sessions@example.com')
    const second = await login('sessions@example.com')

    const before = await fetchWithJar<{ sessions: unknown[] }>(second, '/api/users/me/sessions')
    expect(before.body.sessions).toHaveLength(2)

    const res = await fetchWithJar<{ revoked: number }>(second, '/api/users/me/sessions', {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
    expect(res.body.revoked).toBe(1)

    const after = await fetchWithJar<{ sessions: { current: boolean }[] }>(second, '/api/users/me/sessions')
    expect(after.body.sessions).toHaveLength(1)
    expect(after.body.sessions[0]!.current).toBe(true)

    const dead = await fetchWithJar(first, '/api/users/me')
    expect(dead.status).toBe(401)
  })
})

describe('удаление аккаунта', () => {
  it('единственный владелец команды получает 422 и остаётся жив', async () => {
    const { jar } = await registerUser('sole-owner@example.com')

    const res = await fetchWithJar<{ message: string }>(jar, '/api/users/me', {
      method: 'DELETE',
      body: { password: PASSWORD },
    })
    expect(res.status).toBe(422)
    expect(res.body.message).toContain('Reg WS')

    const me = await fetchWithJar(jar, '/api/users/me')
    expect(me.status).toBe(200)
  })

  it('неверный пароль даёт 401 и не удаляет пользователя', async () => {
    const { jar } = await registerUser('wrong-pass@example.com')

    const res = await fetchWithJar(jar, '/api/users/me', {
      method: 'DELETE',
      body: { password: 'definitely not the one 9' },
    })
    expect(res.status).toBe(401)

    const me = await fetchWithJar(jar, '/api/users/me')
    expect(me.status).toBe(200)
  })

  it('удаляет пользователя, когда у команды есть второй владелец', async () => {
    const owner = await registerUser('leaving@example.com')
    const heir = await registerUser('heir@example.com')

    const ws = await fetchWithJar<{ workspaces: { id: string; name: string }[] }>(owner.jar, '/api/workspaces')
    const wsId = ws.body.workspaces[0]!.id

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
      method: 'POST',
      body: { email: 'heir@example.com', role: 'admin' },
    })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members/${heir.id}`, {
      method: 'PATCH',
      body: { role: 'owner' },
    })

    const res = await fetchWithJar(owner.jar, '/api/users/me', {
      method: 'DELETE',
      body: { password: PASSWORD },
    })
    expect(res.status).toBe(204)

    const gone = await fetchWithJar(owner.jar, '/api/users/me')
    expect(gone.status).toBe(401)

    const sql = getTestSql()
    const rows = await sql`select id from users where email = 'leaving@example.com'`
    expect(rows).toHaveLength(0)

    const stillThere = await fetchWithJar<{ workspaces: { id: string }[] }>(heir.jar, '/api/workspaces')
    expect(stillThere.body.workspaces.some(w => w.id === wsId)).toBe(true)
  })
})
