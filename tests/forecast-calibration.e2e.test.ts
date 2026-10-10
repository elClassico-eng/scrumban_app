import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { baseUrl, CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { BoardForecastJournal, CalibrationRow } from '../shared/types/forecast'

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
      workspace: { name: 'Reg WS', slug: `reg-${Math.random().toString(36).slice(2, 8)}` },
    },
    headers: { 'x-forwarded-for': `10.5.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return { email, jar, id: res.body.user.id }
}

async function createWorkspace(actor: UserCtx): Promise<string> {
  const res = await fetchWithJar<{ workspace: { id: string } }>(actor.jar, '/api/workspaces', {
    method: 'POST',
    body: { name: 'ACME', slug: 'acme' },
  })
  return res.body.workspace.id
}

async function addMember(owner: UserCtx, wsId: string, email: string, role: 'viewer' | 'member') {
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, { method: 'POST', body: { email, role } })
}

type Columns = Record<'backlog' | 'in_progress' | 'review' | 'done', string>
type BoardCtx = { boardId: string; columns: Columns }

async function createBoard(actor: UserCtx, wsId: string): Promise<BoardCtx> {
  const board = await fetchWithJar<{ board: { id: string } }>(actor.jar, `/api/workspaces/${wsId}/boards`, {
    method: 'POST',
    body: { name: 'Main; "quoted"', slug: 'main' },
  })
  const boardId = board.body.board.id
  const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/columns`,
  )
  const columns = Object.fromEntries(cols.body.columns.map((c) => [c.columnRole, c.id])) as Columns
  return { boardId, columns }
}

async function createTask(actor: UserCtx, wsId: string, ctx: BoardCtx, title: string): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks`,
    { method: 'POST', body: { columnId: ctx.columns.backlog, title } },
  )
  return res.body.task.id
}

async function closeTask(actor: UserCtx, wsId: string, ctx: BoardCtx, taskId: string) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: { toColumnId: ctx.columns.done, toPosition: 0 },
  })
}

async function seedHistory(actor: UserCtx, wsId: string, ctx: BoardCtx, count: number) {
  for (let i = 0; i < count; i++) {
    const id = await createTask(actor, wsId, ctx, `history-${i}`)
    await closeTask(actor, wsId, ctx, id)
  }
}

async function createSprint(actor: UserCtx, wsId: string, ctx: BoardCtx, name: string, taskIds: string[]): Promise<string> {
  const sprint = await fetchWithJar<{ sprint: { id: string } }>(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints`, {
    method: 'POST',
    body: {
      name,
      plannedStartAt: new Date().toISOString(),
      plannedEndAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    },
  })
  for (const taskId of taskIds) {
    await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprint.body.sprint.id}/tasks`, {
      method: 'POST',
      body: { taskId },
    })
  }
  return sprint.body.sprint.id
}

const startSprint = (a: UserCtx, ws: string, ctx: BoardCtx, id: string) =>
  fetchWithJar(a.jar, `/api/workspaces/${ws}/boards/${ctx.boardId}/sprints/${id}/start`, { method: 'POST' })
const closeSprint = (a: UserCtx, ws: string, ctx: BoardCtx, id: string) =>
  fetchWithJar(a.jar, `/api/workspaces/${ws}/boards/${ctx.boardId}/sprints/${id}/close`, { method: 'POST' })

const journalPath = (ws: string, b: string) => `/api/workspaces/${ws}/boards/${b}/forecast-journal`

async function boardWithTwoSprints(owner: UserCtx) {
  const wsId = await createWorkspace(owner)
  const ctx = await createBoard(owner, wsId)
  await seedHistory(owner, wsId, ctx, 5)
  const t1 = await createTask(owner, wsId, ctx, 'closed; "one"')
  const closedId = await createSprint(owner, wsId, ctx, 'Sprint closed', [t1])
  await startSprint(owner, wsId, ctx, closedId)
  await closeTask(owner, wsId, ctx, t1)
  await closeSprint(owner, wsId, ctx, closedId)
  const t2 = await createTask(owner, wsId, ctx, 'active')
  const activeId = await createSprint(owner, wsId, ctx, 'Sprint active', [t2])
  await startSprint(owner, wsId, ctx, activeId)
  return { wsId, ctx, closedId, activeId }
}

describe('forecast journal', () => {
  it('lists active and closed sprints with snapshots and outcome', async () => {
    const owner = await registerUser('owner@example.com')
    const { wsId, ctx, closedId, activeId } = await boardWithTwoSprints(owner)

    const res = await fetchWithJar<BoardForecastJournal>(owner.jar, journalPath(wsId, ctx.boardId))
    expect(res.status).toBe(200)
    expect(res.body.sprints.map((s) => s.sprint.id)).toEqual([activeId, closedId])
    expect(res.body.sprints[0]!.outcome).toBeNull()
    expect(res.body.sprints[0]!.snapshots.map((s) => s.trigger)).toEqual(['sprint_start'])
    expect(res.body.sprints[1]!.outcome?.outcome).toBe('hit')
    expect(res.body.sprints[1]!.snapshots.map((s) => s.trigger)).toEqual(['sprint_start', 'sprint_close'])
  })

  it('viewer gets 200, stranger 404', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoard(owner, wsId)
    const viewer = await registerUser('viewer@example.com')
    await addMember(owner, wsId, viewer.email, 'viewer')
    expect((await fetchWithJar(viewer.jar, journalPath(wsId, ctx.boardId))).status).toBe(200)
    const stranger = await registerUser('stranger@example.com')
    expect((await fetchWithJar(stranger.jar, journalPath(wsId, ctx.boardId))).status).toBe(404)
    expect((await fetchWithJar(stranger.jar, `${journalPath(wsId, ctx.boardId)}/export`)).status).toBe(404)
  })
})

describe('forecast exports', () => {
  it('journal export csv starts with BOM, has a header and escapes the sprint name', async () => {
    const owner = await registerUser('owner@example.com')
    const { wsId, ctx } = await boardWithTwoSprints(owner)
    const raw = await fetch(`${baseUrl()}${journalPath(wsId, ctx.boardId)}/export?format=csv`, {
      headers: { cookie: owner.jar.header },
    })
    expect(raw.status).toBe(200)
    expect(raw.headers.get('content-disposition')).toMatch(/^attachment; filename="forecast-journal-main-\d{4}-\d{2}-\d{2}\.csv"$/)
    const bytes = new Uint8Array(await raw.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xEF, 0xBB, 0xBF])
    const text = new TextDecoder('utf-8').decode(bytes)
    const lines = text.split('\r\n')
    expect(lines[0]).toBe('sprintId;sprintName;trigger;takenAt;p50Days;p85Days;p95Days;networkProbability;naiveProbability;pertExpectedDays;pertSigmaDays;remainingCount;committedSp;horizonDays;closedSamples;edgeCount')
    expect(lines.filter((l) => l.length > 0)).toHaveLength(4)
    expect(lines.some((l) => l.startsWith('"') === false && l.includes('Sprint closed'))).toBe(true)
  })

  it('calibration export json is an array with outcome', async () => {
    const owner = await registerUser('owner@example.com')
    const { wsId, ctx, closedId } = await boardWithTwoSprints(owner)
    const res = await fetchWithJar<CalibrationRow[]>(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/forecast-calibration/export?format=json`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toMatchObject({ sprintId: closedId, outcome: 'hit' })
  })
})
