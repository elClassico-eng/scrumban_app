// Open (email-less) invitations may not carry admin+ roles — token
// possession alone must not grant a high-privilege seat. Open links stay
// available for scrum_master and below; admin+ requires an email binding.
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

interface UserCtx { jar: CookieJar, wsId: string }

async function registerOwner(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ workspace: { id: string } }>(
    jar,
    '/api/auth/register',
    {
      method: 'POST',
      body: { email, password: 'correct horse battery 1', workspace: { name: 'WS', slug: 'team' } },
      headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    },
  )
  return { jar, wsId: res.body.workspace.id }
}

async function createInvite(owner: UserCtx, body: { role: string, email?: string }): Promise<number> {
  const res = await fetchWithJar(owner.jar, `/api/workspaces/${owner.wsId}/invitations`, {
    method: 'POST',
    body,
  })
  return res.status
}

describe('invitation policy: open links cannot grant admin+', () => {
  it('rejects an open (no-email) admin invitation', async () => {
    const owner = await registerOwner('m3-owner@example.com')
    const status = await createInvite(owner, { role: 'admin' })
    expect(status).toBe(422)
  })

  it('allows an open (no-email) member invitation', async () => {
    const owner = await registerOwner('m3b-owner@example.com')
    const status = await createInvite(owner, { role: 'member' })
    expect(status).toBe(200)
  })

  it('allows an admin invitation when an email is bound', async () => {
    const owner = await registerOwner('m3c-owner@example.com')
    const status = await createInvite(owner, { role: 'admin', email: 'invitee@example.com' })
    expect(status).toBe(200)
  })
})
