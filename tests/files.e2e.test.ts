import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { baseUrl, CookieJar, fetchWithJar } from './helpers/http'
import { ensureTestBucket, objectExists, TEST_S3, uploadTo } from './helpers/storage'
import { TEST_URL } from './setup.global'

const QUOTA = 64 * 1024
Object.assign(process.env, TEST_S3, { FILES_QUOTA_BYTES: String(QUOTA), APP_URL: 'http://takt.test' })
process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

beforeAll(async () => {
  await ensureTestBucket()
})

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
  await getTestSql()`TRUNCATE storage_trash`
})

type UserCtx = { email: string, jar: CookieJar, id: string }
type Ticket = { file: { id: string, url: string, thumbUrl: string | null, canDelete: boolean }, uploadUrl: string, thumbUploadUrl: string | null }

async function registerUser(prefix: string): Promise<UserCtx> {
  const email = `${prefix}-${crypto.randomUUID().slice(0, 8)}@files.test`
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: { email, password: 'correct horse battery 1', workspace: { name: 'Files WS', slug: `f-${crypto.randomUUID().slice(0, 8)}` } },
    headers: { 'x-forwarded-for': `10.6.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

async function boardWithTask(owner: UserCtx, wsId: string) {
  const board = await fetchWithJar<{ board: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards`, { method: 'POST', body: { name: 'Main', slug: 'main' } })
  const boardId = board.body.board.id
  const cols = await fetchWithJar<{ columns: { id: string, columnRole: string }[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/columns`)
  const task = await fetchWithJar<{ task: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, {
    method: 'POST',
    body: { columnId: cols.body.columns.find(c => c.columnRole === 'backlog')!.id, title: 'С файлами' },
  })
  return { boardId, taskId: task.body.task.id }
}

async function start(user: UserCtx, wsId: string, body: Record<string, unknown>) {
  return fetchWithJar<Ticket>(user.jar, `/api/workspaces/${wsId}/files`, { method: 'POST', body })
}

async function complete(user: UserCtx, wsId: string, fileId: string) {
  return fetchWithJar<{ file: { id: string } }>(user.jar, `/api/workspaces/${wsId}/files/${fileId}/complete`, { method: 'POST' })
}

async function attach(user: UserCtx, wsId: string, taskId: string, content = 'hello file', extra: Record<string, unknown> = {}) {
  const ticket = await start(user, wsId, { kind: 'attachment', taskId, name: 'note.txt', contentType: 'text/plain', size: Buffer.byteLength(content), ...extra })
  expect(ticket.status).toBe(200)
  expect(await uploadTo(ticket.body.uploadUrl, content, 'text/plain')).toBe(200)
  const done = await complete(user, wsId, ticket.body.file.id)
  return { ticket: ticket.body, done }
}

describe('upload', () => {
  it('runs start → put → complete and counts usage', async () => {
    const owner = await registerUser('up')
    const wsId = await workspaceOf(owner)
    const { taskId } = await boardWithTask(owner, wsId)
    const { done } = await attach(owner, wsId, taskId)
    expect(done.status).toBe(200)
    const usage = await fetchWithJar<{ usedBytes: number, limitBytes: number }>(owner.jar, `/api/workspaces/${wsId}/files/usage`)
    expect(usage.body).toEqual({ usedBytes: 10, limitBytes: QUOTA })
  })

  it('rejects completion when the stored size differs', async () => {
    const owner = await registerUser('sz')
    const wsId = await workspaceOf(owner)
    const { taskId } = await boardWithTask(owner, wsId)
    const ticket = await start(owner, wsId, { kind: 'attachment', taskId, name: 'a.txt', contentType: 'text/plain', size: 5 })
    await uploadTo(ticket.body.uploadUrl, 'more than five', 'text/plain')
    expect((await complete(owner, wsId, ticket.body.file.id)).status).toBe(422)
    const rows = await getTestSql()`SELECT count(*)::int AS n FROM files`
    expect(rows[0]!.n).toBe(0)
  })

  it('enforces the workspace quota before upload, also for parallel starts', async () => {
    const owner = await registerUser('q')
    const wsId = await workspaceOf(owner)
    const { taskId } = await boardWithTask(owner, wsId)
    const half = QUOTA / 2 + 1
    const [a, b] = await Promise.all([
      start(owner, wsId, { kind: 'attachment', taskId, name: 'a.bin', contentType: 'application/octet-stream', size: half }),
      start(owner, wsId, { kind: 'attachment', taskId, name: 'b.bin', contentType: 'application/octet-stream', size: half }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 422])
  })

  it('viewer cannot upload; author and admin delete; another member cannot', async () => {
    const owner = await registerUser('o')
    const member = await registerUser('m')
    const other = await registerUser('x')
    const viewer = await registerUser('v')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, member.email, 'member')
    await addMember(owner, wsId, other.email, 'member')
    await addMember(owner, wsId, viewer.email, 'viewer')
    const { taskId } = await boardWithTask(owner, wsId)
    expect((await start(viewer, wsId, { kind: 'attachment', taskId, name: 'a.txt', contentType: 'text/plain', size: 3 })).status).toBe(403)
    const { ticket } = await attach(member, wsId, taskId)
    expect((await fetchWithJar(other.jar, `/api/workspaces/${wsId}/files/${ticket.file.id}`, { method: 'DELETE' })).status).toBe(403)
    expect((await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/files/${ticket.file.id}`, { method: 'DELETE' })).status).toBe(200)
    const trash = await getTestSql()`SELECT count(*)::int AS n FROM storage_trash`
    expect(trash[0]!.n).toBe(1)
  })

  it('replacing the avatar sends the old file to the trash and updates avatar_url', async () => {
    const user = await registerUser('av')
    for (let i = 0; i < 2; i++) {
      const ticket = await fetchWithJar<Ticket>(user.jar, '/api/users/me/avatar', { method: 'POST', body: { name: 'a.webp', contentType: 'image/webp', size: 4 } })
      expect(ticket.status).toBe(200)
      await uploadTo(ticket.body.uploadUrl, 'webp', 'image/webp')
      expect((await fetchWithJar(user.jar, `/api/users/me/avatar/${ticket.body.file.id}/complete`, { method: 'POST' })).status).toBe(200)
    }
    const [u] = await getTestSql()`SELECT avatar_url FROM users WHERE id = ${user.id}`
    expect(u!.avatar_url).toMatch(/^\/api\/files\/u\//)
    const rows = await getTestSql()`SELECT count(*)::int AS n FROM files WHERE kind = 'user_avatar'`
    expect(rows[0]!.n).toBe(1)
    expect((await getTestSql()`SELECT count(*)::int AS n FROM storage_trash`)[0]!.n).toBe(1)
  })

  it('keeps at most one pending avatar upload per user', async () => {
    const user = await registerUser('pa')
    for (let i = 0; i < 3; i++) {
      await fetchWithJar(user.jar, '/api/users/me/avatar', { method: 'POST', body: { name: 'a.webp', contentType: 'image/webp', size: 4 } })
    }
    const rows = await getTestSql()`SELECT count(*)::int AS n FROM files WHERE kind = 'user_avatar' AND status = 'pending'`
    expect(rows[0]!.n).toBe(1)
  })

  it('logo upload sets workspace logo_url', async () => {
    const owner = await registerUser('logo')
    const wsId = await workspaceOf(owner)
    const ticket = await start(owner, wsId, { kind: 'workspace_logo', name: 'l.png', contentType: 'image/png', size: 3 })
    await uploadTo(ticket.body.uploadUrl, 'png', 'image/png')
    await complete(owner, wsId, ticket.body.file.id)
    const [w] = await getTestSql()`SELECT logo_url FROM workspaces WHERE id = ${wsId}`
    expect(w!.logo_url).toBe(`/api/files/w/${wsId}/${ticket.body.file.id}`)
  })
})

async function follow(user: UserCtx, path: string) {
  return fetch(`${baseUrl()}${path}`, { headers: { cookie: user.jar.header }, redirect: 'manual' })
}

describe('serving', () => {
  it('redirects members to a signed url and hides files from outsiders', async () => {
    const owner = await registerUser('s')
    const outsider = await registerUser('out')
    const wsId = await workspaceOf(owner)
    const { taskId } = await boardWithTask(owner, wsId)
    const { ticket } = await attach(owner, wsId, taskId, 'secret body')
    const res = await follow(owner, ticket.file.url)
    expect(res.status).toBe(302)
    expect(res.headers.get('cache-control')).toMatch(/private, max-age=\d+/)
    const location = res.headers.get('location')!
    expect(location).toContain('X-Amz-Signature')
    expect(await (await fetch(location)).text()).toBe('secret body')
    expect((await follow(outsider, ticket.file.url)).status).toBe(404)
  })

  it('forces download for svg and html', async () => {
    const owner = await registerUser('svg')
    const wsId = await workspaceOf(owner)
    const { taskId } = await boardWithTask(owner, wsId)
    const body = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    const ticket = await start(owner, wsId, { kind: 'attachment', taskId, name: 'x.svg', contentType: 'image/svg+xml', size: Buffer.byteLength(body) })
    await uploadTo(ticket.body.uploadUrl, body, 'image/svg+xml')
    await complete(owner, wsId, ticket.body.file.id)
    const location = (await follow(owner, ticket.body.file.url)).headers.get('location')!
    expect(decodeURIComponent(location)).toContain('response-content-disposition=attachment')
  })

  it('removed member loses access', async () => {
    const owner = await registerUser('rm')
    const member = await registerUser('rmm')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, member.email, 'member')
    const { taskId } = await boardWithTask(owner, wsId)
    const { ticket } = await attach(owner, wsId, taskId)
    expect((await follow(member, ticket.file.url)).status).toBe(302)
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members/${member.id}`, { method: 'DELETE' })
    expect((await follow(member, ticket.file.url)).status).toBe(404)
  })

  it('avatars are visible to people sharing a workspace only', async () => {
    const a = await registerUser('a')
    const b = await registerUser('b')
    const stranger = await registerUser('c')
    const wsId = await workspaceOf(a)
    await addMember(a, wsId, b.email, 'member')
    const ticket = await fetchWithJar<Ticket>(b.jar, '/api/users/me/avatar', { method: 'POST', body: { name: 'a.webp', contentType: 'image/webp', size: 4 } })
    await uploadTo(ticket.body.uploadUrl, 'webp', 'image/webp')
    await fetchWithJar(b.jar, `/api/users/me/avatar/${ticket.body.file.id}/complete`, { method: 'POST' })
    expect((await follow(a, ticket.body.file.url)).status).toBe(302)
    expect((await follow(stranger, ticket.body.file.url)).status).toBe(404)
  })

  it('lists task files including comment files', async () => {
    const owner = await registerUser('ls')
    const wsId = await workspaceOf(owner)
    const { boardId, taskId } = await boardWithTask(owner, wsId)
    await attach(owner, wsId, taskId)
    const list = await fetchWithJar<{ files: { id: string, canDelete: boolean }[] }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/files`)
    expect(list.body.files).toHaveLength(1)
    expect(list.body.files[0]!.canDelete).toBe(true)
  })
})

async function runTask(user: UserCtx, name: string) {
  return fetchWithJar<{ result: Record<string, number> }>(user.jar, `/api/_dev/tasks/${name}/run`, { method: 'POST' })
}

describe('maintenance', () => {
  it('removes stale pending uploads, including avatars', async () => {
    const owner = await registerUser('cl')
    const wsId = await workspaceOf(owner)
    const { taskId } = await boardWithTask(owner, wsId)
    await start(owner, wsId, { kind: 'attachment', taskId, name: 'a.txt', contentType: 'text/plain', size: 3 })
    await fetchWithJar(owner.jar, '/api/users/me/avatar', { method: 'POST', body: { name: 'a.webp', contentType: 'image/webp', size: 4 } })
    await getTestSql()`UPDATE files SET created_at = now() - interval '2 hours'`
    await runTask(owner, 'files:cleanup')
    expect((await getTestSql()`SELECT count(*)::int AS n FROM files`)[0]!.n).toBe(0)
  })

  it('deleting a task trashes its files; purge waits 7 days then deletes objects', async () => {
    const owner = await registerUser('pg')
    const wsId = await workspaceOf(owner)
    const { boardId, taskId } = await boardWithTask(owner, wsId)
    const { ticket } = await attach(owner, wsId, taskId)
    const [row] = await getTestSql()`SELECT storage_key FROM files WHERE id = ${ticket.file.id}`
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}`, { method: 'DELETE' })
    expect((await getTestSql()`SELECT count(*)::int AS n FROM storage_trash`)[0]!.n).toBe(1)
    await runTask(owner, 'files:purge')
    expect(await objectExists(row!.storage_key)).toBe(true)
    await getTestSql()`UPDATE storage_trash SET created_at = now() - interval '8 days'`
    await runTask(owner, 'files:purge')
    expect(await objectExists(row!.storage_key)).toBe(false)
    expect((await getTestSql()`SELECT count(*)::int AS n FROM storage_trash`)[0]!.n).toBe(0)
  })
})

describe('comment attachments', () => {
  it('links own staged files to the comment and ignores foreign ones', async () => {
    const owner = await registerUser('co')
    const other = await registerUser('cx')
    const wsId = await workspaceOf(owner)
    await addMember(owner, wsId, other.email, 'member')
    const { boardId, taskId } = await boardWithTask(owner, wsId)
    const mine = await attach(owner, wsId, taskId, 'mine', { forComment: true })
    const theirs = await attach(other, wsId, taskId, 'theirs', { forComment: true })
    const list1 = await fetchWithJar<{ files: unknown[] }>(other.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/files`)
    expect(list1.body.files).toHaveLength(0)
    const res = await fetchWithJar<{ comment: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { body: '', fileIds: [mine.ticket.file.id, theirs.ticket.file.id] },
    })
    expect(res.status).toBe(200)
    const rows = await getTestSql()`SELECT id, status, comment_id FROM files ORDER BY created_at`
    expect(rows.find(r => r.id === mine.ticket.file.id)).toMatchObject({ status: 'ready', comment_id: res.body.comment.id })
    expect(rows.find(r => r.id === theirs.ticket.file.id)).toMatchObject({ status: 'staged', comment_id: null })
  })

  it('rejects an empty comment without files', async () => {
    const owner = await registerUser('ce')
    const wsId = await workspaceOf(owner)
    const { boardId, taskId } = await boardWithTask(owner, wsId)
    const res = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/comments`, { method: 'POST', body: { body: '   ' } })
    expect([400, 422]).toContain(res.status)
  })
})
