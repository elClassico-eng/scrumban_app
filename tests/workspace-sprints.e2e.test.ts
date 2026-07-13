// End-to-end tests for GET /api/workspaces/:id/sprints — the workspace-level
// sprint listing that powers the Reports & Retrospectives hub. It aggregates
// sprints across every board of the workspace and carries the board name.
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

async function createBoard(actor: UserCtx, wsId: string, name: string, slug: string): Promise<string> {
  const res = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name, slug } },
  )
  return res.body.board.id
}

async function createSprint(actor: UserCtx, wsId: string, boardId: string, name: string): Promise<string> {
  const res = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    { method: 'POST', body: { name } },
  )
  return res.body.sprint.id
}

interface WsSprint {
  id: string
  name: string
  boardId: string
  boardName: string
  state: string
}

describe('GET /workspaces/:id/sprints', () => {
  it('aggregates sprints across every board with the board name', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardA = await createBoard(owner, wsId, 'Backend', 'backend')
    const boardB = await createBoard(owner, wsId, 'Frontend', 'frontend')
    await createSprint(owner, wsId, boardA, 'BE Sprint 1')
    await createSprint(owner, wsId, boardB, 'FE Sprint 1')

    const res = await fetchWithJar<{ sprints: WsSprint[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/sprints`,
    )
    expect(res.status).toBe(200)
    expect(res.body.sprints).toHaveLength(2)

    const byName = Object.fromEntries(res.body.sprints.map(s => [s.name, s]))
    expect(byName['BE Sprint 1']?.boardName).toBe('Backend')
    expect(byName['BE Sprint 1']?.boardId).toBe(boardA)
    expect(byName['FE Sprint 1']?.boardName).toBe('Frontend')
    expect(byName['FE Sprint 1']?.boardId).toBe(boardB)
  })

  it('viewer can list workspace sprints', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    const boardId = await createBoard(owner, wsId, 'Main', 'main')
    await createSprint(owner, wsId, boardId, 'Sprint 1')

    const res = await fetchWithJar<{ sprints: WsSprint[] }>(
      viewer.jar,
      `/api/workspaces/${wsId}/sprints`,
    )
    expect(res.status).toBe(200)
    expect(res.body.sprints).toHaveLength(1)
  })

  it('does not leak sprints from another workspace', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner, 'acme')
    const boardId = await createBoard(owner, wsId, 'Main', 'main')
    await createSprint(owner, wsId, boardId, 'Own Sprint')

    const otherWs = await createWorkspace(owner, 'other')
    const otherBoard = await createBoard(owner, otherWs, 'Other', 'other')
    await createSprint(owner, otherWs, otherBoard, 'Other Sprint')

    const res = await fetchWithJar<{ sprints: WsSprint[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/sprints`,
    )
    expect(res.status).toBe(200)
    expect(res.body.sprints.map(s => s.name)).toEqual(['Own Sprint'])
  })

  it('non-member is forbidden (404)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId, 'Main', 'main')
    await createSprint(owner, wsId, boardId, 'Sprint 1')

    const res = await fetchWithJar(stranger.jar, `/api/workspaces/${wsId}/sprints`)
    expect(res.status).toBe(404)
  })
})
