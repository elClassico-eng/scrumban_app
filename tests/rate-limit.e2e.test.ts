// Auth rate-limit must key on the real client IP, not a client-spoofable
// X-Forwarded-For value. Caddy appends the real client IP as the LAST XFF
// element; the app is not publicly reachable except through Caddy, so the
// last element is trustworthy and the first element is attacker-controlled.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup, useTestContext } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { TEST_URL } from './setup.global'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

// Raw login POST with a chosen X-Forwarded-For; returns the HTTP status.
async function loginStatus(xff: string, email: string): Promise<number> {
  const ctx = useTestContext()
  const base = ctx.url!.replace(/\/$/, '')
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-forwarded-for': xff,
    },
    body: JSON.stringify({ email, password: 'wrong-password-123' }),
  })
  return res.status
}

describe('auth rate-limit: keys on the trusted (last) X-Forwarded-For element', () => {
  it('blocks the 6th attempt even when the spoofable first XFF element rotates', async () => {
    const email = 'ratelimit-h1@example.com'
    // Constant trusted suffix (as Caddy would append); rotating spoofed prefix.
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      statuses.push(await loginStatus(`9.9.9.${i}, 203.0.113.7`, email))
    }

    // First 5 reach the handler (401 bad creds); the 6th is rate-limited.
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses[5]).toBe(429)
  })
})
