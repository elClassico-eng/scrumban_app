import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'

process.env.DATABASE_URL = TEST_URL
process.env.ADMIN_EMAILS = 'admin@example.com'

await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
  await getTestSql().unsafe('TRUNCATE TABLE "leads"')
})

function uniqueIp(): Record<string, string> {
  return { 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` }
}

async function postLead(body: Record<string, unknown>) {
  return fetchWithJar(new CookieJar(), '/api/leads', { method: 'POST', body, headers: uniqueIp() })
}

describe('POST /api/leads (pilot application)', () => {
  it('stores team size, current tool and the consent time', async () => {
    const res = await postLead({ email: 'pilot@example.com', teamSize: '35', currentTool: 'Jira', consent: true })
    expect(res.status).toBe(200)

    const rows = await getTestSql()`SELECT email, team_size, current_tool, consent_at FROM leads`
    expect(rows).toHaveLength(1)
    expect(rows[0]!.email).toBe('pilot@example.com')
    expect(rows[0]!.team_size).toBe('35')
    expect(rows[0]!.current_tool).toBe('Jira')
    expect(rows[0]!.consent_at).not.toBeNull()
  })

  it('rejects an application without consent', async () => {
    const res = await postLead({ email: 'pilot@example.com', teamSize: '35' })
    expect(res.status).toBe(400)
  })

  it('silently drops a filled honeypot', async () => {
    const res = await postLead({ email: 'bot@example.com', consent: true, company: 'Spam Inc' })
    expect(res.status).toBe(200)
    const rows = await getTestSql()`SELECT id FROM leads`
    expect(rows).toHaveLength(0)
  })

  it('shows the new fields to the admin', async () => {
    await postLead({ email: 'pilot@example.com', teamSize: '35', currentTool: 'Trello', consent: true })

    const admin = new CookieJar()
    await fetchWithJar(admin, '/api/auth/register', {
      method: 'POST',
      body: { email: 'admin@example.com', password: 'correct horse battery 1' },
      headers: uniqueIp(),
    })
    const res = await fetchWithJar<{ leads: Array<{ teamSize: string | null, currentTool: string | null }> }>(admin, '/api/admin/leads')
    expect(res.status).toBe(200)
    expect(res.body.leads[0]).toMatchObject({ teamSize: '35', currentTool: 'Trello' })
  })
})
