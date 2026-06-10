// Role-grant invariant: a non-owner may not grant a role EQUAL to their own
// (only owners may appoint co-owners). This aligns the member-role-patch path
// with the invite/add paths, which already use strictlyOutranks.
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

interface UserCtx { email: string, jar: CookieJar, id: string, wsId: string }

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string }, workspace: { id: string } }>(
    jar,
    '/api/auth/register',
    {
      method: 'POST',
      body: { email, password: 'correct horse battery 1', workspace: { name: 'WS', slug: 'team' } },
      headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    },
  )
  return { email, jar, id: res.body.user.id, wsId: res.body.workspace.id }
}

async function addMember(owner: UserCtx, email: string, role: string): Promise<void> {
  await fetchWithJar(owner.jar, `/api/workspaces/${owner.wsId}/members`, {
    method: 'POST',
    body: { email, role },
  })
}

async function patchRole(actor: UserCtx, wsId: string, targetUserId: string, role: string): Promise<number> {
  const res = await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/members/${targetUserId}`, {
    method: 'PATCH',
    body: { role },
  })
  return res.status
}

describe('RBAC: role-grant invariant on member-role patch', () => {
  it('an admin cannot promote a member to admin (no peer minting)', async () => {
    const owner = await registerUser('m2-owner@example.com')
    const adminU = await registerUser('m2-admin@example.com')
    const targetU = await registerUser('m2-target@example.com')
    await addMember(owner, adminU.email, 'admin')
    await addMember(owner, targetU.email, 'member')

    const status = await patchRole(adminU, owner.wsId, targetU.id, 'admin')
    expect(status).toBe(403)
  })

  it('an owner CAN promote a member to owner (co-owner appointment still works)', async () => {
    const owner = await registerUser('m2b-owner@example.com')
    const memberU = await registerUser('m2b-member@example.com')
    await addMember(owner, memberU.email, 'member')

    const status = await patchRole(owner, owner.wsId, memberU.id, 'owner')
    expect(status).toBe(200)
  })
})
