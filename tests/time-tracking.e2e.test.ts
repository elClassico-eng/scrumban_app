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

interface UserCtx {
  email: string
  jar: CookieJar
  id: string
}

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string; email: string } }>(
    jar,
    '/api/auth/register',
    {
      method: 'POST',
      body: {
        email,
        password: 'correct horse battery 1',
        workspace: { name: 'Reg WS', slug: 'reg-ws' },
      },
      headers: { 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
    },
  )
  return { email, jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx, slug = 'acme'): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(
    actor.jar,
    '/api/workspaces',
    { method: 'POST', body: { name: slug.toUpperCase(), slug } },
  )
  return res.body.workspace.id
}

async function addMember(
  owner: UserCtx,
  wsId: string,
  email: string,
  role: 'viewer' | 'member' | 'scrum_master' | 'admin',
): Promise<void> {
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
    method: 'POST',
    body: { email, role },
  })
}

interface BoardCtx {
  boardId: string
  columns: Record<'backlog' | 'in_progress' | 'review' | 'done', string>
}

async function createBoardWithColumns(actor: UserCtx, wsId: string): Promise<BoardCtx> {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: 'Main', slug: 'main' } },
  )
  const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${board.body.board.id}/columns`,
  )
  const lookup = Object.fromEntries(cols.body.columns.map((c) => [c.columnRole, c.id])) as Record<
    'backlog' | 'in_progress' | 'review' | 'done',
    string
  >
  return { boardId: board.body.board.id, columns: lookup }
}

describe('time tracking — start/stop', () => {
  it('start creates a running entry; stop finalizes duration', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const t = await fetchWithJar<{ task: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, { method: 'POST', body: { columnId: columns.backlog, title: 'T' } })
    const taskId = t.body.task.id

    const before = await fetchWithJar<{ active: unknown }>(owner.jar, `/api/workspaces/${wsId}/time/active`, {})
    expect(before.body.active).toBeNull()

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/time/start`, { method: 'POST' })
    const active = await fetchWithJar<{ active: { entry: { running: boolean }, taskTitle: string } | null }>(owner.jar, `/api/workspaces/${wsId}/time/active`, {})
    expect(active.body.active?.entry.running).toBe(true)
    expect(active.body.active?.taskTitle).toBe('T')

    const stop = await fetchWithJar<{ entry: { durationSeconds: number | null } | null }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/time/stop`, { method: 'POST' })
    expect(stop.body.entry?.durationSeconds).toBeGreaterThanOrEqual(0)

    const after = await fetchWithJar<{ active: unknown }>(owner.jar, `/api/workspaces/${wsId}/time/active`, {})
    expect(after.body.active).toBeNull()
  })

  it('starting a second timer stops the first; only one running per user', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const mk = async (title: string) => (await fetchWithJar<{ task: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks`, { method: 'POST', body: { columnId: columns.backlog, title } })).body.task.id
    const a = await mk('A'); const b = await mk('B')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${a}/time/start`, { method: 'POST' })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${b}/time/start`, { method: 'POST' })
    const active = await fetchWithJar<{ active: { taskTitle: string } | null }>(owner.jar, `/api/workspaces/${wsId}/time/active`, {})
    expect(active.body.active?.taskTitle).toBe('B')
    const aEntries = await fetchWithJar<{ entries: Array<{ running: boolean }> }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${a}/time`, {})
    expect(aEntries.body.entries.every(e => !e.running)).toBe(true)
  })
})
