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

type UserCtx = {
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
        workspace: { name: 'Home', slug: 'home' },
      },
      headers: { 'x-forwarded-for': `10.4.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
    },
  )
  return { email, jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx, slug: string): Promise<string> {
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

type WsListItem = { id: string; myLabel: string | null }

async function listWorkspaces(actor: UserCtx): Promise<WsListItem[]> {
  const res = await fetchWithJar<{ workspaces: WsListItem[] }>(actor.jar, '/api/workspaces')
  return res.body.workspaces
}

describe('DELETE /api/workspaces/:id', () => {
  it('owner deletes the workspace and its boards cascade', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner, 'acme')
    const board = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Main', slug: 'main' } },
    )
    expect(board.status).toBe(200)

    const del = await fetchWithJar<{ ok: boolean }>(owner.jar, `/api/workspaces/${wsId}`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(200)
    expect(del.body.ok).toBe(true)

    const after = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}`)
    expect(after.status).toBe(404)
    const boardsAfter = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards`)
    expect(boardsAfter.status).toBe(404)
  })

  it('non-owner member cannot delete (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const admin = await registerUser('admin@example.com')
    const wsId = await createWorkspace(owner, 'acme')
    await addMember(owner, wsId, 'admin@example.com', 'admin')

    const del = await fetchWithJar(admin.jar, `/api/workspaces/${wsId}`, { method: 'DELETE' })
    expect(del.status).toBe(403)
  })

  it('non-member cannot delete (404, no existence leak)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner, 'acme')

    const del = await fetchWithJar(stranger.jar, `/api/workspaces/${wsId}`, { method: 'DELETE' })
    expect(del.status).toBe(404)
  })

  it('requires auth (401)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner, 'acme')
    const del = await fetchWithJar(new CookieJar(), `/api/workspaces/${wsId}`, { method: 'DELETE' })
    expect(del.status).toBe(401)
  })
})

describe('PUT /api/workspaces/:id/label', () => {
  it('member sets a personal label that appears in their own list', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner, 'acme')

    const put = await fetchWithJar<{ label: string | null }>(
      owner.jar,
      `/api/workspaces/${wsId}/label`,
      { method: 'PUT', body: { label: 'Работа' } },
    )
    expect(put.status).toBe(200)
    expect(put.body.label).toBe('Работа')

    const list = await listWorkspaces(owner)
    expect(list.find(w => w.id === wsId)?.myLabel).toBe('Работа')
  })

  it('label is private — another member of the same workspace does not see it', async () => {
    const owner = await registerUser('owner@example.com')
    const mate = await registerUser('mate@example.com')
    const wsId = await createWorkspace(owner, 'acme')
    await addMember(owner, wsId, 'mate@example.com', 'member')

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/label`, {
      method: 'PUT',
      body: { label: 'Личное' },
    })

    const ownerList = await listWorkspaces(owner)
    expect(ownerList.find(w => w.id === wsId)?.myLabel).toBe('Личное')

    const mateList = await listWorkspaces(mate)
    expect(mateList.find(w => w.id === wsId)?.myLabel).toBeNull()
  })

  it('null clears the label', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner, 'acme')

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/label`, {
      method: 'PUT',
      body: { label: 'Работа' },
    })
    const cleared = await fetchWithJar<{ label: string | null }>(
      owner.jar,
      `/api/workspaces/${wsId}/label`,
      { method: 'PUT', body: { label: null } },
    )
    expect(cleared.body.label).toBeNull()

    const list = await listWorkspaces(owner)
    expect(list.find(w => w.id === wsId)?.myLabel).toBeNull()
  })

  it('upsert overwrites the previous label', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner, 'acme')

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/label`, {
      method: 'PUT',
      body: { label: 'Работа' },
    })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/label`, {
      method: 'PUT',
      body: { label: 'Учёба' },
    })

    const list = await listWorkspaces(owner)
    expect(list.find(w => w.id === wsId)?.myLabel).toBe('Учёба')
  })

  it('non-member cannot label a workspace (404)', async () => {
    const owner = await registerUser('owner@example.com')
    const stranger = await registerUser('stranger@example.com')
    const wsId = await createWorkspace(owner, 'acme')

    const put = await fetchWithJar(stranger.jar, `/api/workspaces/${wsId}/label`, {
      method: 'PUT',
      body: { label: 'X' },
    })
    expect(put.status).toBe(404)
  })
})

describe('GET /api/workspaces (myLabel)', () => {
  it('returns myLabel: null for workspaces without a label', async () => {
    const owner = await registerUser('owner@example.com')
    await createWorkspace(owner, 'acme')

    const list = await listWorkspaces(owner)
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list.every(w => w.myLabel === null)).toBe(true)
  })
})
