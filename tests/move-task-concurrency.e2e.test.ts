// Concurrency test for moveTask. The destination column's WIP limit and the
// position renumbering are both read-modify-write sequences; without a lock
// that serializes moves into the same column, two concurrent moves can both
// pass the WIP check and overfill the column (and duplicate positions).
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
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

interface BoardCtx {
  boardId: string
  columns: Record<'backlog' | 'in_progress' | 'review' | 'done', string>
}

async function createBoard(actor: UserCtx, wsId: string, slug: string): Promise<BoardCtx> {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: slug, slug } },
  )
  const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${board.body.board.id}/columns`,
  )
  const lookup = Object.fromEntries(cols.body.columns.map(c => [c.columnRole, c.id])) as Record<
    'backlog' | 'in_progress' | 'review' | 'done',
    string
  >
  return { boardId: board.body.board.id, columns: lookup }
}

async function createTask(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  columnId: string,
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title: 'T' } },
  )
  return res.body.task.id
}

describe('moveTask concurrency: WIP limit holds under parallel moves', () => {
  it('two concurrent moves into a WIP=1 column never exceed the limit', async () => {
    const owner = await registerUser('wip@example.com')
    const wsId = await createWorkspace(owner, 'wip-ws')
    const { boardId, columns } = await createBoard(owner, wsId, 'wip-board')

    // Cap the destination column at one task.
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${columns.in_progress}`,
      { method: 'PATCH', body: { wipLimit: 1 } },
    )

    // Source columns differ on purpose: same-source moves serialize on
    // shared row locks during gap-closing and would hide the WIP race.
    const t1 = await createTask(owner, wsId, boardId, columns.backlog)
    const t2 = await createTask(owner, wsId, boardId, columns.review)

    // Fire both moves into the WIP=1 column at the same time.
    const [r1, r2] = await Promise.all([
      fetchWithJar(
        owner.jar,
        `/api/workspaces/${wsId}/boards/${boardId}/tasks/${t1}/move`,
        { method: 'POST', body: { toColumnId: columns.in_progress, toPosition: 0 } },
      ),
      fetchWithJar(
        owner.jar,
        `/api/workspaces/${wsId}/boards/${boardId}/tasks/${t2}/move`,
        { method: 'POST', body: { toColumnId: columns.in_progress, toPosition: 0 } },
      ),
    ])

    const statuses = [r1.status, r2.status].sort()
    // Exactly one move should land; the other must be rejected with 422.
    expect(statuses).toEqual([200, 422])

    const sql = getTestSql()
    const rows = await sql<{ c: number }[]>`
      SELECT count(*)::int AS c FROM tasks WHERE column_id = ${columns.in_progress}
    `
    expect(rows[0]!.c).toBe(1)
  })
})
