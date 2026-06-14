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

type UserCtx = { jar: CookieJar; id: string }

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'correct horse battery 1',
      workspace: { name: 'Reg WS', slug: `reg-ws-${Math.random().toString(36).slice(2)}` },
    },
    headers: {
      'x-forwarded-for': `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`,
    },
  })
  return { jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx, slug: string): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(actor.jar, '/api/workspaces', {
    method: 'POST',
    body: { name: slug.toUpperCase(), slug },
  })
  return res.body.workspace.id
}

async function createBoardWithBacklog(
  actor: UserCtx,
  wsId: string,
  boardName: string,
): Promise<{ boardId: string; backlogColumnId: string }> {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: boardName, slug: boardName.toLowerCase().replace(/\s/g, '-') } },
  )
  const boardId = board.body.board.id
  const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/columns`,
  )
  const backlogColumnId = cols.body.columns.find((c) => c.columnRole === 'backlog')!.id
  return { boardId, backlogColumnId }
}

async function createTask(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  columnId: string,
  title: string,
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title } },
  )
  return res.body.task.id
}

describe('GET /api/workspaces/:id/tasks', () => {
  it('returns tasks from all boards in the workspace', async () => {
    const owner = await registerUser('ws-tasks-owner@example.com')
    const wsId = await createWorkspace(owner, `ws-tasks-${Date.now()}`)

    const { boardId: board1Id, backlogColumnId: col1 } = await createBoardWithBacklog(
      owner,
      wsId,
      'Board Alpha',
    )
    const { boardId: board2Id, backlogColumnId: col2 } = await createBoardWithBacklog(
      owner,
      wsId,
      'Board Beta',
    )

    const task1Id = await createTask(owner, wsId, board1Id, col1, 'Task on board 1')
    const task2Id = await createTask(owner, wsId, board2Id, col2, 'Task on board 2')

    const res = await fetchWithJar<{ tasks: { id: string; boardId: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/tasks`,
    )

    expect(res.status).toBe(200)
    expect(res.body.tasks).toHaveLength(2)

    const returnedIds = res.body.tasks.map((t) => t.id)
    expect(returnedIds).toContain(task1Id)
    expect(returnedIds).toContain(task2Id)

    const returnedBoardIds = res.body.tasks.map((t) => t.boardId)
    expect(returnedBoardIds).toContain(board1Id)
    expect(returnedBoardIds).toContain(board2Id)
  })

  it('does not return tasks from a different workspace (tenant isolation)', async () => {
    const owner = await registerUser('ws-tasks-isolation@example.com')
    const wsId = await createWorkspace(owner, `ws-iso-${Date.now()}`)
    const { boardId, backlogColumnId } = await createBoardWithBacklog(owner, wsId, 'My Board')
    await createTask(owner, wsId, boardId, backlogColumnId, 'My task')

    const otherOwner = await registerUser('ws-tasks-other@example.com')
    const otherWsId = await createWorkspace(otherOwner, `ws-other-${Date.now()}`)
    const { boardId: otherBoard, backlogColumnId: otherCol } = await createBoardWithBacklog(
      otherOwner,
      otherWsId,
      'Other Board',
    )
    await createTask(otherOwner, otherWsId, otherBoard, otherCol, 'Other task')

    const res = await fetchWithJar<{ tasks: { id: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/tasks`,
    )

    expect(res.status).toBe(200)
    expect(res.body.tasks).toHaveLength(1)
    expect(res.body.tasks[0]!.id).not.toBeUndefined()
  })

  it('returns 401 for unauthenticated request', async () => {
    const owner = await registerUser('ws-tasks-unauth@example.com')
    const wsId = await createWorkspace(owner, `ws-unauth-${Date.now()}`)

    const anonJar = new CookieJar()
    const res = await fetchWithJar(anonJar, `/api/workspaces/${wsId}/tasks`)
    expect(res.status).toBe(401)
  })
})
