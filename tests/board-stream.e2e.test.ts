// End-to-end tests for the board SSE stream authorization. The stream
// must verify that the board in the URL actually belongs to the workspace
// in the URL — otherwise a member of any workspace can subscribe to a
// foreign board's event channel and receive cross-tenant task events.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup, useTestContext } from '@nuxt/test-utils/e2e'
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

// Opens the SSE endpoint and returns only the HTTP status, then aborts the
// connection. We must NOT read the body — a successful stream stays open
// forever and would hang the test. fetch() resolves as soon as the response
// headers (and thus the status) arrive.
async function streamStatus(jar: CookieJar, path: string): Promise<number> {
  const ctx = useTestContext()
  const base = ctx.url!.replace(/\/$/, '')
  const controller = new AbortController()
  try {
    const res = await fetch(base + path, {
      headers: {
        accept: 'text/event-stream',
        ...(jar.header ? { cookie: jar.header } : {}),
      },
      signal: controller.signal,
    })
    return res.status
  } finally {
    controller.abort()
  }
}

describe('board SSE stream: cross-tenant isolation', () => {
  it('rejects a foreign board id under your own workspace URL (no event leak)', async () => {
    const u = await registerUser('streama@example.com')
    const otherOwner = await registerUser('streamb@example.com')
    const wsA = await createWorkspace(u, 'alpha')
    const wsB = await createWorkspace(otherOwner, 'beta')
    const boardA = await createBoard(u, wsA, 'a-board')
    const boardB = await createBoard(otherOwner, wsB, 'b-board')

    // u is a member of wsA only. Hitting the wsA URL with wsB's board must
    // not open the stream — the board does not belong to wsA.
    const foreign = await streamStatus(u.jar, `/api/workspaces/${wsA}/boards/${boardB}/stream`)
    expect(foreign).toBe(404)

    // Sanity: u CAN stream their own board.
    const own = await streamStatus(u.jar, `/api/workspaces/${wsA}/boards/${boardA}/stream`)
    expect(own).toBe(200)
  })

  it('rejects a non-member opening any board stream (workspace gate)', async () => {
    const owner = await registerUser('streamowner@example.com')
    const stranger = await registerUser('streamstranger@example.com')
    const wsId = await createWorkspace(owner, 'closed')
    const boardId = await createBoard(owner, wsId, 'main')

    const status = await streamStatus(stranger.jar, `/api/workspaces/${wsId}/boards/${boardId}/stream`)
    expect(status).toBe(404)
  })
})
