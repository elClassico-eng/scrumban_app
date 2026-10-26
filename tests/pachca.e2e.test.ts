import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { ALL_SCOPES, startFakePachca } from './helpers/fake-pachca'
import { TEST_URL } from './setup.global'

const APP = 'http://takt.test'
const fake = await startFakePachca()
process.env.PACHCA_API_BASE = fake.url
process.env.INTEGRATIONS_SECRET = Buffer.alloc(32, 7).toString('base64')
process.env.APP_URL = APP
process.env.FEED_SETTLE_MS = '0'
process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

const BOT_TOKEN = 'bot-token-0001'
const BOT_ID = 900

afterAll(async () => {
  await closeTestSql()
  await fake.close()
})

beforeEach(async () => {
  await resetDb()
  fake.reset()
  fake.state.tokens.set(BOT_TOKEN, { userId: BOT_ID, scopes: ALL_SCOPES })
})

type UserCtx = { email: string, jar: CookieJar, id: string }

async function registerUser(prefix: string): Promise<UserCtx> {
  const email = `${prefix}-${crypto.randomUUID().slice(0, 8)}@pachca.test`
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: { email, password: 'correct horse battery 1', workspace: { name: 'Пачка WS', slug: `p-${crypto.randomUUID().slice(0, 8)}` } },
    headers: { 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return { email, jar, id: res.body.user.id }
}

async function workspaceOf(user: UserCtx): Promise<string> {
  const res = await fetchWithJar<{ workspaces: { id: string }[] }>(user.jar, '/api/workspaces')
  return res.body.workspaces[0]!.id
}

async function addMember(owner: UserCtx, wsId: string, email: string, role: 'viewer' | 'member' | 'admin') {
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, { method: 'POST', body: { email, role } })
}

async function connect(owner: UserCtx, wsId: string, body: Record<string, unknown> = { token: BOT_TOKEN }) {
  return fetchWithJar<{ integration: { status: string, tokenHint: string } }>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca`, { method: 'PUT', body })
}

describe('pachca client via fake', () => {
  it('fake answers token info for a known token', async () => {
    const res = await fetch(`${fake.url}/oauth/token/info`, { headers: { authorization: `Bearer ${BOT_TOKEN}` } })
    expect(res.status).toBe(200)
    expect((await res.json() as { data: { user_id: number } }).data.user_id).toBe(BOT_ID)
  })
})

describe('connect', () => {
  it('saves an encrypted token and never returns it', async () => {
    const owner = await registerUser('owner')
    const wsId = await workspaceOf(owner)
    const res = await connect(owner, wsId)
    expect(res.status).toBe(200)
    expect(res.body.integration).toMatchObject({ status: 'active', tokenHint: '0001' })
    expect(JSON.stringify(res.body)).not.toContain(BOT_TOKEN)

    const [row] = await getTestSql()`SELECT bot_token_enc FROM workspace_integrations WHERE workspace_id = ${wsId}`
    expect(row!.bot_token_enc).toMatch(/^v1:/)
    expect(row!.bot_token_enc).not.toContain(BOT_TOKEN)

    const state = await fetchWithJar<Record<string, unknown>>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca`)
    expect(state.body).toMatchObject({ available: true, canManage: true, integration: { botName: 'Такт', emailsVisible: false } })
    expect(JSON.stringify(state.body)).not.toContain(BOT_TOKEN)
  })

  it('rejects a token Pachca does not accept or one without scopes', async () => {
    const owner = await registerUser('bad')
    const wsId = await workspaceOf(owner)
    expect((await connect(owner, wsId, { token: 'unknown-token-xx' })).status).toBe(422)
    fake.state.tokens.set('narrow-token-01', { userId: 901, scopes: ['messages:create'] })
    const narrow = await connect(owner, wsId, { token: 'narrow-token-01' })
    expect(narrow.status).toBe(422)
    expect(JSON.stringify(narrow.body)).toContain('users:read')
  })

  it('only admins connect; members read state without secrets', async () => {
    const owner = await registerUser('own')
    const member = await registerUser('mem')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, member.email, 'member')
    expect((await connect(member, wsId)).status).toBe(403)
    await connect(owner, wsId)
    const state = await fetchWithJar<{ canManage: boolean, integration: unknown }>(member.jar, `/api/workspaces/${wsId}/integrations/pachca`)
    expect(state.body.canManage).toBe(false)
    expect(state.body.integration).not.toBeNull()
  })

  it('stores the signing secret and disconnect removes everything', async () => {
    const owner = await registerUser('sec')
    const wsId = await workspaceOf(owner)
    await connect(owner, wsId)
    const withSecret = await connect(owner, wsId, { signingSecret: 'whsec-12345678' })
    expect(withSecret.body.integration).toMatchObject({ linkPreviews: true })
    const del = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/integrations/pachca`, { method: 'DELETE' })
    expect(del.status).toBe(200)
    const rows = await getTestSql()`SELECT count(*)::int AS n FROM workspace_integrations WHERE workspace_id = ${wsId}`
    expect(rows[0]!.n).toBe(0)
  })
})
