// End-to-end tests for the move-task endpoint and the state-machine
// side effects (closed_at, reopened_count) and task_events log.
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

describe('POST /tasks/:id/move — cross-column moves', () => {
  it('moves a task to a new column and updates positions', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTaskIn(owner, wsId, boardId, columns.backlog, 'task A')

    const res = await fetchWithJar<{
      task: { columnId: string; position: number; closedAt: string | null }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`, {
      method: 'POST',
      body: { toColumnId: columns.in_progress, toPosition: 0 },
    })
    expect(res.status).toBe(200)
    expect(res.body.task.columnId).toBe(columns.in_progress)
    expect(res.body.task.position).toBe(0)
    expect(res.body.task.closedAt).toBeNull()
  })

  it('moving into Done sets closed_at and emits task_closed', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTaskIn(owner, wsId, boardId, columns.in_progress, 'task A')

    const moved = await fetchWithJar<{ task: { closedAt: string | null } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`,
      { method: 'POST', body: { toColumnId: columns.done, toPosition: 0 } },
    )
    expect(moved.body.task.closedAt).not.toBeNull()

    const events = await fetchWithJar<{ events: { eventType: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/events`,
    )
    expect(events.body.events.map((e) => e.eventType)).toEqual(['task_closed'])
  })

  it('moving out of Done clears closed_at and bumps reopened_count', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTaskIn(owner, wsId, boardId, columns.done, 'closed task')

    // First close it via a move that registers the closed_at timestamp
    // (otherwise create-in-Done leaves closed_at NULL and the reopen
    // logic doesn't trigger). Move done→done is a no-op with no closing.
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`,
      { method: 'POST', body: { toColumnId: columns.in_progress, toPosition: 0 } },
    )
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`,
      { method: 'POST', body: { toColumnId: columns.done, toPosition: 0 } },
    )

    const reopened = await fetchWithJar<{
      task: { closedAt: string | null; reopenedCount: number }
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`, {
      method: 'POST',
      body: { toColumnId: columns.in_progress, toPosition: 0 },
    })
    expect(reopened.body.task.closedAt).toBeNull()
    expect(reopened.body.task.reopenedCount).toBe(1)

    const events = await fetchWithJar<{ events: { eventType: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/events`,
    )
    expect(events.body.events.map((e) => e.eventType)).toEqual([
      'task_moved',    // initial done → in_progress (no close yet)
      'task_closed',   // in_progress → done
      'task_reopened', // done → in_progress
    ])
  })

  it('rejects move to a column on a different board (422)', async () => {
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
    const otherBoardCol = board2cols.body.columns[0]!.id

    const taskId = await createTaskIn(owner, wsId, a.boardId, a.columns.backlog, 't')
    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${a.boardId}/tasks/${taskId}/move`,
      { method: 'POST', body: { toColumnId: otherBoardCol, toPosition: 0 } },
    )
    expect(res.status).toBe(422)
  })
})

describe('WIP limit enforcement', () => {
  it('blocks the move when destination column is at the limit', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    // Set WIP=1 on In Progress
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${columns.in_progress}`,
      { method: 'PATCH', body: { wipLimit: 1 } },
    )
    // Park one task in In Progress already
    await createTaskIn(owner, wsId, boardId, columns.in_progress, 'occupant')
    const newTaskId = await createTaskIn(owner, wsId, boardId, columns.backlog, 'newcomer')

    const res = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${newTaskId}/move`,
      { method: 'POST', body: { toColumnId: columns.in_progress, toPosition: 0 } },
    )
    expect(res.status).toBe(422)
  })

  it('force=true overrides the WIP limit', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns/${columns.in_progress}`,
      { method: 'PATCH', body: { wipLimit: 1 } },
    )
    await createTaskIn(owner, wsId, boardId, columns.in_progress, 'occupant')
    const newTaskId = await createTaskIn(owner, wsId, boardId, columns.backlog, 'newcomer')

    const res = await fetchWithJar<{ task: { columnId: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${newTaskId}/move`,
      { method: 'POST', body: { toColumnId: columns.in_progress, toPosition: 0, force: true } },
    )
    expect(res.status).toBe(200)
    expect(res.body.task.columnId).toBe(columns.in_progress)
  })
})

describe('same-column reorder', () => {
  it('moving downward shifts intermediates up', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const t0 = await createTaskIn(owner, wsId, boardId, columns.backlog, 't0')
    const t1 = await createTaskIn(owner, wsId, boardId, columns.backlog, 't1')
    const t2 = await createTaskIn(owner, wsId, boardId, columns.backlog, 't2')

    // Move t0 from position 0 to position 2 (the end).
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${t0}/move`,
      { method: 'POST', body: { toColumnId: columns.backlog, toPosition: 2 } },
    )

    const list = await fetchWithJar<{ tasks: { id: string; position: number }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    )
    const byId = Object.fromEntries(list.body.tasks.map((t) => [t.id, t.position]))
    expect(byId[t1]).toBe(0)
    expect(byId[t2]).toBe(1)
    expect(byId[t0]).toBe(2)
  })

  it('moving upward shifts intermediates down', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const t0 = await createTaskIn(owner, wsId, boardId, columns.backlog, 't0')
    const t1 = await createTaskIn(owner, wsId, boardId, columns.backlog, 't1')
    const t2 = await createTaskIn(owner, wsId, boardId, columns.backlog, 't2')

    // Move t2 from position 2 to position 0 (the head).
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${t2}/move`,
      { method: 'POST', body: { toColumnId: columns.backlog, toPosition: 0 } },
    )

    const list = await fetchWithJar<{ tasks: { id: string; position: number }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    )
    const byId = Object.fromEntries(list.body.tasks.map((t) => [t.id, t.position]))
    expect(byId[t2]).toBe(0)
    expect(byId[t0]).toBe(1)
    expect(byId[t1]).toBe(2)
  })
})

describe('RBAC', () => {
  it('viewer cannot move (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTaskIn(owner, wsId, boardId, columns.backlog, 't')

    const res = await fetchWithJar(
      viewer.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`,
      { method: 'POST', body: { toColumnId: columns.in_progress, toPosition: 0 } },
    )
    expect(res.status).toBe(403)
  })
})
