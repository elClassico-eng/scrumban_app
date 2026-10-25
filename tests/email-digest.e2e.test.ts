import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

const MAILPIT = 'http://127.0.0.1:8025/api/v1'

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

type UserCtx = { email: string, jar: CookieJar, id: string }
type Mail = { ID: string, Subject: string }

async function registerUser(prefix: string): Promise<UserCtx> {
  const email = `${prefix}-${crypto.randomUUID().slice(0, 8)}@digest.test`
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: { email, password: 'correct horse battery 1', workspace: { name: 'Digest WS', slug: `d-${email.slice(0, 12).replace(/[^a-z0-9]/g, '')}` } },
    headers: { 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  await getTestSql()`UPDATE users SET email_verified_at = now() WHERE id = ${res.body.user.id}`
  return { email, jar, id: res.body.user.id }
}

async function mailsTo(email: string): Promise<Mail[]> {
  const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`)
  const body = await res.json() as { messages: Mail[] }
  return body.messages
}

async function mailText(id: string): Promise<string> {
  const res = await fetch(`${MAILPIT}/message/${id}`)
  return (await res.json() as { Text: string }).Text
}

async function waitForMail(email: string, subject: string): Promise<Mail | undefined> {
  for (let i = 0; i < 20; i++) {
    const found = (await mailsTo(email)).find(m => m.Subject.includes(subject))
    if (found) return found
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}

async function setupBoard(owner: UserCtx) {
  const ws = await fetchWithJar<{ workspaces: { id: string }[] }>(owner.jar, '/api/workspaces')
  const wsId = ws.body.workspaces[0]!.id
  const board = await fetchWithJar<{ board: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards`, {
    method: 'POST',
    body: { name: 'Main', slug: 'main' },
  })
  const boardId = board.body.board.id
  const cols = await fetchWithJar<{ columns: { id: string, columnRole: string }[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`)
  return { wsId, boardId, backlog: cols.body.columns.find(c => c.columnRole === 'backlog')!.id }
}

async function runDigest(actor: UserCtx) {
  const res = await fetchWithJar<{ result: { sent: number, skipped: number } }>(actor.jar, '/api/_dev/tasks/notifications:daily-digest/run', { method: 'POST' })
  expect(res.status).toBe(200)
  return res.body.result
}

describe('email digest', () => {
  it('присылает просроченное и блокеры, без новостей письма нет', async () => {
    const owner = await registerUser('owner')
    expect(await runDigest(owner)).toMatchObject({ sent: 0 })

    const { wsId, boardId, backlog } = await setupBoard(owner)
    const created = await fetchWithJar<{ task: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: backlog, title: 'Починить оплату', assigneeId: owner.id, dueDate: new Date(Date.now() - 3 * 86_400_000).toISOString() },
    })
    await getTestSql()`UPDATE tasks SET blocked_reason = 'ждём доступ' WHERE id = ${created.body.task.id}`

    expect(await runDigest(owner)).toMatchObject({ sent: 1 })
    const mail = await waitForMail(owner.email, 'на сегодня')
    expect(mail).toBeDefined()
    const text = await mailText(mail!.ID)
    expect(text).toContain('Просрочено')
    expect(text).toContain('Починить оплату')
    expect(text).toContain('просрочено на 3 дн')
    expect(text).toContain('блокер: ждём доступ')
  })

  it('выключенный дайджест и неподтверждённая почта не получают писем', async () => {
    const owner = await registerUser('off')
    const { wsId, boardId, backlog } = await setupBoard(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: backlog, title: 'Горит', assigneeId: owner.id, dueDate: new Date(Date.now() - 86_400_000).toISOString() },
    })
    const patch = await fetchWithJar(owner.jar, '/api/users/me', { method: 'PATCH', body: { emailPrefs: { digest: false, instant: [] } } })
    expect(patch.status).toBe(200)
    expect(await runDigest(owner)).toMatchObject({ sent: 0 })

    await fetchWithJar(owner.jar, '/api/users/me', { method: 'PATCH', body: { emailPrefs: { digest: true, instant: [] } } })
    await getTestSql()`UPDATE users SET email_verified_at = NULL WHERE id = ${owner.id}`
    expect(await runDigest(owner)).toMatchObject({ sent: 0 })
  })

  it('мгновенное письмо о назначении только если тип включён', async () => {
    const owner = await registerUser('lead')
    const dev = await registerUser('dev')
    const { wsId, boardId, backlog } = await setupBoard(owner)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, { method: 'POST', body: { email: dev.email, role: 'member' } })

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: backlog, title: 'Без письма', assigneeId: dev.id },
    })
    await new Promise(resolve => setTimeout(resolve, 3000))
    await fetchWithJar(dev.jar, '/api/users/me', { method: 'PATCH', body: { emailPrefs: { digest: true, instant: ['assigned'] } } })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
      method: 'POST',
      body: { columnId: backlog, title: 'С письмом', assigneeId: dev.id },
    })

    expect(await waitForMail(dev.email, 'С письмом')).toBeDefined()
    expect((await mailsTo(dev.email)).some(m => m.Subject.includes('Без письма'))).toBe(false)
  })

  it('отклоняет неизвестный тип мгновенных писем', async () => {
    const owner = await registerUser('bad')
    const res = await fetchWithJar(owner.jar, '/api/users/me', { method: 'PATCH', body: { emailPrefs: { digest: true, instant: ['sle_breach'] } } })
    expect(res.status).toBe(400)
  })
})
