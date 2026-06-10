// End-to-end test for POST /sle/recompute. computeAndStoreSLE must run its
// board read + update inside the tenant transaction; a bare useDB() query
// sees zero rows under the NOBYPASSRLS app role, so the endpoint used to
// 404 on every call regardless of input.
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

async function createWorkspace(actor: UserCtx, slug: string): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(
    actor.jar,
    '/api/workspaces',
    { method: 'POST', body: { name: slug.toUpperCase(), slug } },
  )
  return res.body.workspace.id
}

async function createBoard(actor: UserCtx, wsId: string, slug: string): Promise<string> {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: slug, slug } },
  )
  return board.body.board.id
}

describe('sle recompute: tenant context', () => {
  it('recomputes SLE for a board with no closed tasks (200, null result)', async () => {
    const owner = await registerUser('sle@example.com')
    const wsId = await createWorkspace(owner, 'sle-ws')
    const boardId = await createBoard(owner, wsId, 'sle-board')

    const res = await fetchWithJar<{ sleDays: number | null; sampleCount: number }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sle/recompute`,
      { method: 'POST' },
    )

    expect(res.status).toBe(200)
    expect(res.body.sampleCount).toBe(0)
    expect(res.body.sleDays).toBeNull()
  })
})
