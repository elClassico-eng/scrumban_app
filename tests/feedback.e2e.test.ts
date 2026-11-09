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
  await getTestSql().unsafe('TRUNCATE TABLE "feedback"')
})

function uniqueIp(): Record<string, string> {
  return { 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` }
}

async function postFeedback(body: Record<string, unknown>, jar = new CookieJar(), headers = uniqueIp()) {
  return fetchWithJar(jar, '/api/feedback', { method: 'POST', body, headers })
}

describe('POST /api/feedback', () => {
  it('stores an anonymous review', async () => {
    const res = await postFeedback({ liked: 'Прогноз', disliked: 'Мало интеграций', rating: 4 })
    expect(res.status).toBe(200)
    const rows = await getTestSql()`SELECT liked, disliked, missing, rating, user_id, consent_at FROM feedback`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ liked: 'Прогноз', disliked: 'Мало интеграций', missing: null, rating: 4, user_id: null, consent_at: null })
  })

  it('treats whitespace-only texts as empty', async () => {
    const res = await postFeedback({ liked: '   ', disliked: '\n', missing: ' ' })
    expect(res.status).toBe(400)
  })

  it('requires consent when an email is given', async () => {
    const res = await postFeedback({ liked: 'Доска', email: 'me@example.com' })
    expect(res.status).toBe(400)
  })

  it('stores the consent time when contact data comes with consent', async () => {
    const res = await postFeedback({ liked: 'Доска', email: 'me@example.com', team: 'Команда А', consent: true })
    expect(res.status).toBe(200)
    const rows = await getTestSql()`SELECT email, team, consent_at FROM feedback`
    expect(rows[0]!.email).toBe('me@example.com')
    expect(rows[0]!.team).toBe('Команда А')
    expect(rows[0]!.consent_at).not.toBeNull()
  })

  it('requires an email to ask for a reply', async () => {
    const res = await postFeedback({ liked: 'Доска', wantsReply: true })
    expect(res.status).toBe(400)
  })

  it('rejects a rating outside 1..5', async () => {
    const res = await postFeedback({ liked: 'Доска', rating: 6 })
    expect(res.status).toBe(400)
  })

  it('silently drops a filled honeypot', async () => {
    const res = await postFeedback({ liked: 'Спам', company: 'Spam Inc' })
    expect(res.status).toBe(200)
    const rows = await getTestSql()`SELECT id FROM feedback`
    expect(rows).toHaveLength(0)
  })

  it('links the review to the signed-in user', async () => {
    const jar = new CookieJar()
    const reg = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'correct horse battery 1' },
      headers: uniqueIp(),
    })
    const res = await postFeedback({ missing: 'Импорт из Jira' }, jar)
    expect(res.status).toBe(200)
    const rows = await getTestSql()`SELECT user_id FROM feedback`
    expect(rows[0]!.user_id).toBe(reg.body.user.id)
  })

  it('rate-limits repeated submissions from one address', async () => {
    const headers = uniqueIp()
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await postFeedback({ liked: `Отзыв ${i}` }, new CookieJar(), headers)
      statuses.push(res.status)
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
    expect(statuses[5]).toBe(429)
  })
})
