// E2E tests for Phase 3 advanced analytics: CFD, Monte Carlo, Little's Law.
// Probabilistic outputs are asserted qualitatively (within sane ranges)
// since simulations use Math.random and aren't seedable.
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

async function moveTask(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  taskId: string,
  columnId: string,
): Promise<void> {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: { toColumnId: columnId, toPosition: 0 },
  })
}

describe('GET /analytics/cfd', () => {
  it('returns one point per day with per-column counts', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const t1 = await createTask(owner, wsId, boardId, columns.backlog, 't1')
    const t2 = await createTask(owner, wsId, boardId, columns.backlog, 't2')
    await moveTask(owner, wsId, boardId, t1, columns.in_progress)
    await moveTask(owner, wsId, boardId, t1, columns.done)

    const res = await fetchWithJar<{
      columns: { id: string; columnRole: string }[]
      points: { date: string; counts: Record<string, number> }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/cfd`)

    expect(res.status).toBe(200)
    expect(res.body.columns).toHaveLength(4)
    expect(res.body.points.length).toBeGreaterThan(0)
    // Last point reflects current state: t1 in done, t2 in backlog.
    const last = res.body.points.at(-1)!
    expect(last.counts[columns.done]).toBe(1)
    expect(last.counts[columns.backlog]).toBe(1)
    expect(last.counts[columns.in_progress]).toBe(0)
  })

  it('returns zero counts for an empty board', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar<{
      points: { counts: Record<string, number> }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/cfd`)
    const last = res.body.points.at(-1)!
    expect(last.counts[columns.backlog]).toBe(0)
    expect(last.counts[columns.done]).toBe(0)
  })
})

describe('GET /analytics/monte-carlo', () => {
  it('returns insufficient_data with no history', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const res = await fetchWithJar<{
      ok: boolean
      reason?: string
      sampleDays?: number
      requiredDays?: number
    }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/analytics/monte-carlo?tasksRemaining=10&horizonDays=14`,
    )
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toBe('insufficient_data')
    expect(res.body.requiredDays).toBe(14)
  })

  it('rejects bad query parameters (400)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const r1 = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/analytics/monte-carlo?tasksRemaining=-1&horizonDays=14`,
    )
    expect(r1.status).toBe(400)

    const r2 = await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/analytics/monte-carlo?tasksRemaining=5&horizonDays=999`,
    )
    expect(r2.status).toBe(400)
  })
})

describe('GET /analytics/wip-recommendations', () => {
  it('returns insufficient_data with fewer than 5 closed tasks', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    // 4 closed tasks → below threshold of 5
    for (let i = 0; i < 4; i++) {
      const id = await createTask(owner, wsId, boardId, columns.backlog, `t${i}`)
      await moveTask(owner, wsId, boardId, id, columns.done)
    }

    const res = await fetchWithJar<{
      ok: boolean
      reason?: string
      sampleSize?: number
      requiredSamples?: number
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/wip-recommendations`)
    expect(res.body.ok).toBe(false)
    expect(res.body.reason).toBe('insufficient_data')
    expect(res.body.requiredSamples).toBe(5)
  })

  it('returns recommendations for in_progress and review columns', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    for (let i = 0; i < 5; i++) {
      const id = await createTask(owner, wsId, boardId, columns.backlog, `t${i}`)
      await moveTask(owner, wsId, boardId, id, columns.done)
    }

    const res = await fetchWithJar<{
      ok: boolean
      throughputPerDay?: number
      meanCycleTimeDays?: number
      columns?: { columnRole: string; recommendedWip: number }[]
    }>(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/analytics/wip-recommendations`)
    expect(res.body.ok).toBe(true)
    expect(res.body.throughputPerDay).toBeGreaterThan(0)
    // Two target roles: in_progress + review
    expect(res.body.columns).toHaveLength(2)
    const roles = res.body.columns!.map((c) => c.columnRole).sort()
    expect(roles).toEqual(['in_progress', 'review'])
    for (const c of res.body.columns!) {
      expect(c.recommendedWip).toBeGreaterThanOrEqual(1)
    }
  })
})
