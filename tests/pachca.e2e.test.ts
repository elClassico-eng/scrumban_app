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

async function waitFor<T>(fn: () => T | undefined, ms = 5000): Promise<T | undefined> {
  for (let t = 0; t < ms; t += 100) {
    const v = fn()
    if (v) return v
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

async function linkRequestToken(): Promise<string> {
  const msg = await waitFor(() => fake.state.messages.find(m => m.buttons?.[0]?.[0]?.url.includes('/integrations/pachca/confirm/')))
  return msg!.buttons![0]![0]!.url.split('/').pop()!
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

describe('links', () => {
  it('single link: DM with confirm link, only the requester can confirm, once', async () => {
    const owner = await registerUser('lo')
    const other = await registerUser('lx')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, other.email, 'member')
    fake.state.users.push({ id: 11, first_name: 'Иван', last_name: 'Петров', nickname: 'ivan', email: null, bot: false, suspended: false })
    await connect(owner, wsId)

    const req = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/integrations/pachca/link`, { method: 'POST', body: { pachcaUserId: '11' } })
    expect(req.status).toBe(200)
    const token = await linkRequestToken()
    expect(fake.state.messages.at(-1)).toMatchObject({ entity_type: 'user', entity_id: 11 })

    const foreign = await fetchWithJar<{ valid: boolean, reason?: string }>(other.jar, `/api/integrations/pachca/link/${token}`)
    expect(foreign.body).toMatchObject({ valid: false, reason: 'other_user' })
    expect((await fetchWithJar(other.jar, `/api/integrations/pachca/link/${token}`, { method: 'POST' })).status).toBe(403)

    const inspect = await fetchWithJar(owner.jar, `/api/integrations/pachca/link/${token}`)
    expect(inspect.body).toMatchObject({ valid: true, pachcaName: 'Иван Петров' })
    expect((await fetchWithJar(owner.jar, `/api/integrations/pachca/link/${token}`, { method: 'POST' })).status).toBe(200)
    expect((await fetchWithJar(owner.jar, `/api/integrations/pachca/link/${token}`, { method: 'POST' })).status).toBe(410)

    const state = await fetchWithJar<{ me: { displayName: string, instantTypes: string[] } }>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca`)
    expect(state.body.me).toMatchObject({ displayName: 'Иван Петров' })
    expect(state.body.me.instantTypes).toContain('mention')
    expect(fake.state.messages.at(-1)!.content).toContain('Готово')
  })

  it('expired requests are refused', async () => {
    const owner = await registerUser('le')
    const wsId = await workspaceOf(owner)
    fake.state.users.push({ id: 12, first_name: 'А', last_name: 'Б', nickname: 'ab', email: null, bot: false, suspended: false })
    await connect(owner, wsId)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/integrations/pachca/link`, { method: 'POST', body: { pachcaUserId: '12' } })
    const token = await linkRequestToken()
    await getTestSql()`UPDATE messenger_link_requests SET expires_at = now() - interval '1 minute'`
    expect((await fetchWithJar(owner.jar, `/api/integrations/pachca/link/${token}`, { method: 'POST' })).status).toBe(410)
  })

  it('a Pachca user re-linking to another Takt account replaces the old link', async () => {
    const owner = await registerUser('ra')
    const second = await registerUser('rb')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, second.email, 'member')
    fake.state.users.push({ id: 13, first_name: 'Общий', last_name: 'Аккаунт', nickname: 'shared', email: null, bot: false, suspended: false })
    await connect(owner, wsId)
    for (const u of [owner, second]) {
      fake.state.messages.length = 0
      await fetchWithJar(u.jar, `/api/workspaces/${wsId}/integrations/pachca/link`, { method: 'POST', body: { pachcaUserId: '13' } })
      await fetchWithJar(u.jar, `/api/integrations/pachca/link/${await linkRequestToken()}`, { method: 'POST' })
    }
    const rows = await getTestSql()`SELECT user_id FROM messenger_accounts WHERE workspace_id = ${wsId}`
    expect(rows.map(r => r.user_id)).toEqual([second.id])
  })

  it('bulk invite matches by email, skips linked, survives 429', async () => {
    const owner = await registerUser('bo')
    const a = await registerUser('ba')
    const b = await registerUser('bb')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, a.email, 'member')
    await addMember(owner, wsId, b.email, 'member')
    fake.state.users.push(
      { id: 21, first_name: 'A', last_name: 'A', nickname: 'a', email: a.email, bot: false, suspended: false },
      { id: 22, first_name: 'B', last_name: 'B', nickname: 'b', email: b.email.toUpperCase(), bot: false, suspended: false },
      { id: 23, first_name: 'C', last_name: 'C', nickname: 'c', email: 'stranger@pachca.test', bot: false, suspended: false },
    )
    await connect(owner, wsId)
    const preview = await fetchWithJar<{ matched: number, members: number }>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca/invite-all`, { method: 'POST', body: { dryRun: true } })
    expect(preview.body).toMatchObject({ matched: 2, members: 3 })
    expect(fake.state.messages).toHaveLength(0)

    fake.fail('/messages', 429, 2)
    const sent = await fetchWithJar<{ sent: number }>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca/invite-all`, { method: 'POST', body: { dryRun: false } })
    expect(sent.status).toBe(200)
    expect(sent.body.sent).toBe(1)

    const again = await fetchWithJar<{ sent: number }>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca/invite-all`, { method: 'POST', body: { dryRun: false } })
    expect(again.body.sent).toBe(2)
  })

  it('removing a member drops their link', async () => {
    const owner = await registerUser('mo')
    const member = await registerUser('mm')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, member.email, 'member')
    fake.state.users.push({ id: 31, first_name: 'M', last_name: 'M', nickname: 'm', email: null, bot: false, suspended: false })
    await connect(owner, wsId)
    await fetchWithJar(member.jar, `/api/workspaces/${wsId}/integrations/pachca/link`, { method: 'POST', body: { pachcaUserId: '31' } })
    await fetchWithJar(member.jar, `/api/integrations/pachca/link/${await linkRequestToken()}`, { method: 'POST' })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members/${member.id}`, { method: 'DELETE' })
    const rows = await getTestSql()`SELECT count(*)::int AS n FROM messenger_accounts WHERE user_id = ${member.id}`
    expect(rows[0]!.n).toBe(0)
  })
})

async function linkedPair() {
  const owner = await registerUser('no')
  const dev = await registerUser('nd')
  const wsId = await workspaceOf(owner)
  await addMember(owner, wsId, dev.email, 'member')
  fake.state.users.push({ id: 41, first_name: 'Дев', last_name: 'Девов', nickname: 'dev', email: null, bot: false, suspended: false })
  await connect(owner, wsId)
  await fetchWithJar(dev.jar, `/api/workspaces/${wsId}/integrations/pachca/link`, { method: 'POST', body: { pachcaUserId: '41' } })
  await fetchWithJar(dev.jar, `/api/integrations/pachca/link/${await linkRequestToken()}`, { method: 'POST' })
  const board = await fetchWithJar<{ board: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards`, { method: 'POST', body: { name: 'Main', slug: 'main' } })
  const cols = await fetchWithJar<{ columns: { id: string, columnRole: string }[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${board.body.board.id}/columns`)
  fake.state.messages.length = 0
  return { owner, dev, wsId, boardId: board.body.board.id, backlog: cols.body.columns.find(c => c.columnRole === 'backlog')!.id }
}

describe('notifications', () => {
  it('assignment reaches the linked DM with names and a button', async () => {
    const { owner, dev, wsId, boardId, backlog } = await linkedPair()
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: backlog, title: 'Починить оплату', assigneeId: dev.id },
    })
    const msg = await waitFor(() => fake.state.messages.find(m => m.entity_id === 41))
    expect(msg!.content).toContain('Починить оплату')
    expect(msg!.buttons![0]![0]!.text).toBe('Открыть в Такте')
  })

  it('a disabled type is not sent', async () => {
    const { owner, dev, wsId, boardId, backlog } = await linkedPair()
    await fetchWithJar(dev.jar, `/api/workspaces/${wsId}/integrations/pachca/me`, { method: 'PATCH', body: { instantTypes: ['mention'] } })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: backlog, title: 'Тихо', assigneeId: dev.id },
    })
    await new Promise(resolve => setTimeout(resolve, 3000))
    expect(fake.state.messages.filter(m => m.entity_id === 41)).toHaveLength(0)
  })

  it('a revoked token flips the integration to error once and stops sending', async () => {
    const { owner, dev, wsId, boardId, backlog } = await linkedPair()
    fake.state.tokens.delete(BOT_TOKEN)
    for (const title of ['Раз', 'Два']) {
      await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
        method: 'POST',
        body: { columnId: backlog, title, assigneeId: dev.id },
      })
    }
    await new Promise(resolve => setTimeout(resolve, 3000))
    const state = await fetchWithJar<{ integration: { status: string } }>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca`)
    expect(state.body.integration.status).toBe('error')
    const notes = await getTestSql()`SELECT count(*)::int AS n FROM notifications WHERE type = 'integration_failed' AND user_id = ${owner.id}`
    expect(notes[0]!.n).toBe(1)

    fake.state.tokens.set(BOT_TOKEN, { userId: BOT_ID, scopes: ALL_SCOPES })
    await connect(owner, wsId)
    const restored = await fetchWithJar<{ integration: { status: string } }>(owner.jar, `/api/workspaces/${wsId}/integrations/pachca`)
    expect(restored.body.integration.status).toBe('active')
  })

  it('digest goes to Pachca only when switched on', async () => {
    const { owner, dev, wsId, boardId, backlog } = await linkedPair()
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: backlog, title: 'Горит', assigneeId: dev.id, dueDate: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    })
    await new Promise(resolve => setTimeout(resolve, 3000))
    fake.state.messages.length = 0
    await fetchWithJar(owner.jar, '/api/_dev/tasks/notifications:daily-digest/run', { method: 'POST' })
    expect(fake.state.messages.filter(m => m.content.includes('Доброе утро'))).toHaveLength(0)

    await fetchWithJar(dev.jar, `/api/workspaces/${wsId}/integrations/pachca/me`, { method: 'PATCH', body: { digest: true } })
    await getTestSql()`UPDATE users SET digest_sent_at = NULL`
    await fetchWithJar(owner.jar, '/api/_dev/tasks/notifications:daily-digest/run', { method: 'POST' })
    const digest = fake.state.messages.find(m => m.entity_id === 41 && m.content.includes('Доброе утро'))
    expect(digest!.content).toContain('Горит')
  })
})

async function feedSetup() {
  const owner = await registerUser('fo')
  const wsId = await workspaceOf(owner)
  fake.state.chats.push({ id: 501, name: 'Команда разработки' })
  await connect(owner, wsId)
  const board = await fetchWithJar<{ board: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards`, { method: 'POST', body: { name: 'Поток', slug: 'potok' } })
  const boardId = board.body.board.id
  const cols = await fetchWithJar<{ columns: { id: string, columnRole: string }[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`)
  const feed = await fetchWithJar<{ feed: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/feeds`, {
    method: 'POST',
    body: { chatId: '501', events: ['task_closed', 'task_blocked'], standupTime: null },
  })
  const backlog = cols.body.columns.find(c => c.columnRole === 'backlog')!.id
  const done = cols.body.columns.find(c => c.columnRole === 'done')!.id
  return { owner, wsId, boardId, backlog, done, feedId: feed.body.feed?.id, feedStatus: feed.status }
}

async function createAndClose(ctx: Awaited<ReturnType<typeof feedSetup>>, title: string) {
  const t = await fetchWithJar<{ task: { id: string } }>(ctx.owner.jar, `/api/workspaces/${ctx.wsId}/boards/${ctx.boardId}/tasks`, { method: 'POST', body: { columnId: ctx.backlog, title } })
  await fetchWithJar(ctx.owner.jar, `/api/workspaces/${ctx.wsId}/boards/${ctx.boardId}/tasks/${t.body.task.id}/move`, { method: 'POST', body: { toColumnId: ctx.done, toPosition: 0 } })
}

async function runFeeds(owner: UserCtx) {
  return fetchWithJar<{ result: { sent: number } }>(owner.jar, '/api/_dev/tasks/integrations:feeds/run', { method: 'POST' })
}

describe('feeds', () => {
  it('rejects a chat the bot is not in, and members cannot create feeds', async () => {
    const ctx = await feedSetup()
    expect(ctx.feedStatus).toBe(200)
    const foreign = await fetchWithJar(ctx.owner.jar, `/api/workspaces/${ctx.wsId}/boards/${ctx.boardId}/feeds`, {
      method: 'POST',
      body: { chatId: '999', events: ['task_closed'], standupTime: null },
    })
    expect(foreign.status).toBe(422)
    const member = await registerUser('fm')
    await addMember(ctx.owner, ctx.wsId, member.email, 'member')
    const denied = await fetchWithJar(member.jar, `/api/workspaces/${ctx.wsId}/boards/${ctx.boardId}/feeds`, {
      method: 'POST',
      body: { chatId: '501', events: ['task_closed'], standupTime: null },
    })
    expect(denied.status).toBe(403)
  })

  it('batches closures into one message and never repeats them', async () => {
    const ctx = await feedSetup()
    for (const t of ['Первая', 'Вторая', 'Третья']) await createAndClose(ctx, t)
    fake.state.messages.length = 0
    expect((await runFeeds(ctx.owner)).body.result.sent).toBe(1)
    const msg = fake.state.messages.find(m => m.entity_id === 501)!
    expect(msg.entity_type).toBe('discussion')
    expect(msg.content).toContain('**Закрыто: 3**')
    expect(msg.content).toContain('Вторая')

    expect((await runFeeds(ctx.owner)).body.result.sent).toBe(0)
    await createAndClose(ctx, 'Четвёртая')
    await runFeeds(ctx.owner)
    const last = fake.state.messages.at(-1)!
    expect(last.content).toContain('Четвёртая')
    expect(last.content).not.toContain('Первая')
  })

  it('keeps the cursor on failure and marks the feed failed after an hour', async () => {
    const ctx = await feedSetup()
    await createAndClose(ctx, 'Упадёт')
    fake.fail('/messages', 500, 1)
    expect((await runFeeds(ctx.owner)).body.result.sent).toBe(0)
    await getTestSql()`UPDATE board_feeds SET failing_since = now() - interval '2 hours'`
    fake.fail('/messages', 500, 1)
    await runFeeds(ctx.owner)
    const list = await fetchWithJar<{ feeds: { status: string }[] }>(ctx.owner.jar, `/api/workspaces/${ctx.wsId}/boards/${ctx.boardId}/feeds`)
    expect(list.body.feeds[0]!.status).toBe('error')
  })

  it('sends the standup once per Moscow day', async () => {
    const ctx = await feedSetup()
    await fetchWithJar(ctx.owner.jar, `/api/workspaces/${ctx.wsId}/boards/${ctx.boardId}/feeds/${ctx.feedId}`, { method: 'PATCH', body: { standupTime: '00:00' } })
    fake.state.messages.length = 0
    await runFeeds(ctx.owner)
    await runFeeds(ctx.owner)
    const standups = fake.state.messages.filter(m => m.content.includes('Сводка к стендапу'))
    const msk = new Date(Date.now() + 3 * 3_600_000).getUTCDay()
    expect(standups).toHaveLength(msk === 0 || msk === 6 ? 0 : 1)
  })
})
