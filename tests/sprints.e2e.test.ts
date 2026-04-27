// End-to-end tests for /api/workspaces/:id/boards/:boardId/sprints.
// Covers the planned/active/closed state machine, the "one active per
// board" guard, attach/detach tasks, and the freeze-on-close rule.
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
    { method: 'POST', body: { email, password: 'correct horse battery' } },
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

async function createTaskIn(
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

async function createSprint(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  name: string,
): Promise<string> {
  const res = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    { method: 'POST', body: { name } },
  )
  return res.body.sprint.id
}

describe('POST /sprints', () => {
  it('owner can create a planned sprint', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar<{
      sprint: { name: string; state: string; startedAt: string | null }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints`, {
      method: 'POST',
      body: { name: 'Sprint 1', goal: 'Ship login' },
    })
    expect(res.status).toBe(200)
    expect(res.body.sprint.name).toBe('Sprint 1')
    expect(res.body.sprint.state).toBe('planned')
    expect(res.body.sprint.startedAt).toBeNull()
  })

  it('member cannot create a sprint (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
      { method: 'POST', body: { name: 'Sprint 1' } },
    )
    expect(res.status).toBe(403)
  })

  it('rejects plannedEnd before plannedStart (422)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
      {
        method: 'POST',
        body: {
          name: 'X',
          plannedStartAt: '2026-05-10T00:00:00Z',
          plannedEndAt: '2026-05-01T00:00:00Z',
        },
      },
    )
    expect(res.status).toBe(422)
  })
})

describe('start / close state machine', () => {
  it('start: planned → active sets startedAt', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1')

    const res = await fetchWithJar<{
      sprint: { state: string; startedAt: string | null }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/start`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    expect(res.body.sprint.state).toBe('active')
    expect(res.body.sprint.startedAt).not.toBeNull()
  })

  it('cannot start an already-started sprint (422)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/start`, {
      method: 'POST',
    })

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/start`,
      { method: 'POST' },
    )
    expect(res.status).toBe(422)
  })

  it('only one sprint may be active per board (409)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const a = await createSprint(owner, wsId, boardId, 'A')
    const b = await createSprint(owner, wsId, boardId, 'B')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${a}/start`, {
      method: 'POST',
    })

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${b}/start`,
      { method: 'POST' },
    )
    expect(res.status).toBe(409)
  })

  it('close: active → closed sets endedAt', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/start`, {
      method: 'POST',
    })

    const res = await fetchWithJar<{ sprint: { state: string; endedAt: string | null } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/close`,
      { method: 'POST' },
    )
    expect(res.status).toBe(200)
    expect(res.body.sprint.state).toBe('closed')
    expect(res.body.sprint.endedAt).not.toBeNull()
  })

  it('cannot close an already-closed sprint (422)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/close`, {
      method: 'POST',
    })

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/close`,
      { method: 'POST' },
    )
    expect(res.status).toBe(422)
  })
})

describe('sprint tasks', () => {
  it('member can attach and detach a task on an active sprint', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTaskIn(owner, wsId, boardId, columns.backlog, 't1')
    const sId = await createSprint(owner, wsId, boardId, 'S1')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/start`, {
      method: 'POST',
    })

    const attach = await fetchWithJar(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/tasks`,
      { method: 'POST', body: { taskId } },
    )
    expect(attach.status).toBe(201)

    const sprintGet = await fetchWithJar<{ taskIds: string[] }>(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}`,
    )
    expect(sprintGet.body.taskIds).toContain(taskId)

    const detach = await fetchWithJar(
      dev.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/tasks/${taskId}`,
      { method: 'DELETE' },
    )
    expect(detach.status).toBe(204)
  })

  it('cannot attach a task from a different board (422)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const a = await createBoardWithColumns(owner, wsId)
    const board2 = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Other', slug: 'other' } },
    )
    const board2cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${board2.body.board.id}/columns`,
    )
    const otherCol = board2cols.body.columns.find((c) => c.columnRole === 'backlog')!.id
    const otherTask = await createTaskIn(owner, wsId, board2.body.board.id, otherCol, 'other')
    const sId = await createSprint(owner, wsId, a.boardId, 'S1')

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${a.boardId}/sprints/${sId}/tasks`,
      { method: 'POST', body: { taskId: otherTask } },
    )
    expect(res.status).toBe(422)
  })

  it('cannot attach a task to a closed sprint (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTaskIn(owner, wsId, boardId, columns.backlog, 't1')
    const sId = await createSprint(owner, wsId, boardId, 'S1')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/close`, {
      method: 'POST',
    })

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/tasks`,
      { method: 'POST', body: { taskId } },
    )
    expect(res.status).toBe(403)
  })

  it('rejects duplicate attach (409)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTaskIn(owner, wsId, boardId, columns.backlog, 't1')
    const sId = await createSprint(owner, wsId, boardId, 'S1')
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/tasks`, {
      method: 'POST',
      body: { taskId },
    })

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/tasks`,
      { method: 'POST', body: { taskId } },
    )
    expect(res.status).toBe(409)
  })
})

describe('list / patch / delete', () => {
  it('list returns sprints newest-first', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    await createSprint(owner, wsId, boardId, 'S1')
    await new Promise((r) => setTimeout(r, 10))
    await createSprint(owner, wsId, boardId, 'S2')

    const res = await fetchWithJar<{ sprints: { name: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    )
    expect(res.body.sprints.map((s) => s.name)).toEqual(['S2', 'S1'])
  })

  it('patch updates name and goal', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'old')

    const res = await fetchWithJar<{ sprint: { name: string; goal: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}`,
      { method: 'PATCH', body: { name: 'new', goal: 'ship it' } },
    )
    expect(res.status).toBe(200)
    expect(res.body.sprint.name).toBe('new')
    expect(res.body.sprint.goal).toBe('ship it')
  })

  it('admin can delete a sprint', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1')

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)
  })
})
