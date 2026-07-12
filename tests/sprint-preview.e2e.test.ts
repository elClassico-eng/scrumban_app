import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { SprintPreviewReport } from '../shared/types/sprint'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

type UserCtx = { email: string; jar: CookieJar; id: string }

async function registerUser(email: string): Promise<UserCtx> {
  const jar = new CookieJar()
  const res = await fetchWithJar<{ user: { id: string } }>(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'correct horse battery 1',
      workspace: { name: 'Reg WS', slug: 'reg-ws' },
    },
    headers: { 'x-forwarded-for': `10.5.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return { email, jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx, slug = 'acme'): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(actor.jar, '/api/workspaces', {
    method: 'POST',
    body: { name: slug.toUpperCase(), slug },
  })
  return res.body.workspace.id
}

async function inviteMember(owner: UserCtx, wsId: string, email: string, role: string) {
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, {
    method: 'POST',
    body: { email, role },
  })
}

async function createBoardWithColumns(actor: UserCtx, wsId: string) {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: 'Main', slug: 'main' } },
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
  title: string,
  storyPoints?: number,
) {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title, ...(storyPoints !== undefined ? { storyPoints } : {}) } },
  )
  return res.body.task.id
}

async function closeTask(actor: UserCtx, wsId: string, boardId: string, taskId: string, doneColumnId: string) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: { toColumnId: doneColumnId, toPosition: 0 },
  })
}

async function seedHistory(actor: UserCtx, wsId: string, ctx: Awaited<ReturnType<typeof createBoardWithColumns>>, count: number) {
  for (let i = 0; i < count; i++) {
    const id = await createTask(actor, wsId, ctx.boardId, ctx.columns.backlog, `history-${i}`)
    await closeTask(actor, wsId, ctx.boardId, id, ctx.columns.done)
  }
}

async function addDependency(actor: UserCtx, wsId: string, boardId: string, blockedTaskId: string, blockerTaskId: string) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${blockedTaskId}/dependencies`, {
    method: 'POST',
    body: { blockerTaskId },
  })
}

function previewPath(wsId: string, boardId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/sprint-preview`
}

function previewBody(taskIds: string[]) {
  return {
    taskIds,
    plannedStartAt: new Date().toISOString(),
    plannedEndAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  }
}

describe('POST /boards/:id/sprint-preview', () => {
  it('считает вероятность и критический путь, ничего не создавая', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A', 3)
    const b = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'B', 5)
    await addDependency(owner, wsId, ctx.boardId, b, a)

    const res = await fetchWithJar<SprintPreviewReport>(owner.jar, previewPath(wsId, ctx.boardId), {
      method: 'POST',
      body: previewBody([a, b]),
    })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      expect(res.body.taskCount).toBe(2)
      expect(res.body.edgeCount).toBe(1)
      expect(res.body.totalStoryPoints).toBe(8)
      expect(res.body.criticalPathIds).toEqual([a, b])
      expect(res.body.simulation.probabilityWithinHorizon).not.toBeNull()
      expect(res.body.risks).toEqual([])
    }

    const sql = getTestSql()
    const sprints = await sql`SELECT id FROM sprints`
    expect(sprints).toHaveLength(0)
  })

  it('репортит риски: unestimated и external_dependency (закрытый блокер — не риск)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 5)
    const inside = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'Inside')
    const openBlocker = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'Open blocker', 2)
    const closedBlocker = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'Closed blocker', 2)
    await addDependency(owner, wsId, ctx.boardId, inside, openBlocker)
    await addDependency(owner, wsId, ctx.boardId, inside, closedBlocker)
    await closeTask(owner, wsId, ctx.boardId, closedBlocker, ctx.columns.done)

    const res = await fetchWithJar<SprintPreviewReport>(owner.jar, previewPath(wsId, ctx.boardId), {
      method: 'POST',
      body: previewBody([inside]),
    })
    expect(res.body.ok).toBe(true)
    const types = res.body.risks.map(r => r.type).sort()
    expect(types).toEqual(['external_dependency', 'unestimated'])
    const ext = res.body.risks.find(r => r.type === 'external_dependency')
    if (ext && ext.type === 'external_dependency') {
      expect(ext.blockerTaskId).toBe(openBlocker)
      expect(ext.blockerTitle).toBe('Open blocker')
    }
  })

  it('422 на чужую/закрытую задачу, 403 для member', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    const other = await fetchWithJar<{ board: { id: string } }>(owner.jar, `/api/workspaces/${wsId}/boards`, {
      method: 'POST',
      body: { name: 'Other', slug: 'other' },
    })
    const otherCols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${other.body.board.id}/columns`,
    )
    const foreignTask = await createTask(
      owner, wsId, other.body.board.id,
      otherCols.body.columns.find(c => c.columnRole === 'backlog')!.id,
      'Foreign',
    )

    const foreign = await fetchWithJar(owner.jar, previewPath(wsId, ctx.boardId), {
      method: 'POST',
      body: previewBody([foreignTask]),
    })
    expect(foreign.status).toBe(422)

    const closedId = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'Done task')
    await closeTask(owner, wsId, ctx.boardId, closedId, ctx.columns.done)
    const closed = await fetchWithJar(owner.jar, previewPath(wsId, ctx.boardId), {
      method: 'POST',
      body: previewBody([closedId]),
    })
    expect(closed.status).toBe(422)

    const member = await registerUser('member@example.com')
    await inviteMember(owner, wsId, member.email, 'member')
    const t = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'T')
    const denied = await fetchWithJar(member.jar, previewPath(wsId, ctx.boardId), {
      method: 'POST',
      body: previewBody([t]),
    })
    expect(denied.status).toBe(403)
  })

  it('insufficient_data при пустой истории, но риски всё равно есть', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    const t = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'NoEstimate')

    const res = await fetchWithJar<SprintPreviewReport>(owner.jar, previewPath(wsId, ctx.boardId), {
      method: 'POST',
      body: previewBody([t]),
    })
    expect(res.body.ok).toBe(false)
    if (!res.body.ok) {
      expect(res.body.reason).toBe('insufficient_data')
      expect(res.body.risks.map(r => r.type)).toEqual(['unestimated'])
    }
  })
})
