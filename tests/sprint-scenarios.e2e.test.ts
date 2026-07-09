import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { ScenarioSimulationReport, SprintScenario } from '../shared/types/scenario'

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
        workspace: { name: 'Reg WS', slug: 'reg-ws' },
      },
      headers: { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
    },
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

async function inviteMember(
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

type BoardCtx = {
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
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title } },
  )
  return res.body.task.id
}

async function closeTask(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  taskId: string,
  doneColumnId: string,
): Promise<void> {
  await fetchWithJar(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`,
    { method: 'POST', body: { toColumnId: doneColumnId, toPosition: 0 } },
  )
}

async function seedHistory(actor: UserCtx, wsId: string, ctx: BoardCtx, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const id = await createTask(actor, wsId, ctx.boardId, ctx.columns.backlog, `history-${i}`)
    await closeTask(actor, wsId, ctx.boardId, id, ctx.columns.done)
  }
}

async function addDependency(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  blockedTaskId: string,
  blockerTaskId: string,
): Promise<void> {
  await fetchWithJar(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks/${blockedTaskId}/dependencies`,
    { method: 'POST', body: { blockerTaskId } },
  )
}

async function createSprintWithTasks(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  taskIds: string[],
): Promise<string> {
  const sprint = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    {
      method: 'POST',
      body: {
        name: 'Sprint 1',
        plannedStartAt: new Date().toISOString(),
        plannedEndAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    },
  )
  for (const taskId of taskIds) {
    await fetchWithJar(
      actor.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprint.body.sprint.id}/tasks`,
      { method: 'POST', body: { taskId } },
    )
  }
  return sprint.body.sprint.id
}

type Fixture = {
  owner: UserCtx
  wsId: string
  ctx: BoardCtx
  sprintId: string
  a: string
  b: string
  c: string
  outside: string
}

async function setupFixture(): Promise<Fixture> {
  const owner = await registerUser('owner@example.com')
  const wsId = await createWorkspace(owner)
  const ctx = await createBoardWithColumns(owner, wsId)
  await seedHistory(owner, wsId, ctx, 5)
  const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A')
  const b = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'B')
  const c = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'C')
  const outside = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'Outside')
  await addDependency(owner, wsId, ctx.boardId, b, a)
  await addDependency(owner, wsId, ctx.boardId, c, b)
  const sprintId = await createSprintWithTasks(owner, wsId, ctx.boardId, [a, b, c])
  return { owner, wsId, ctx, sprintId, a, b, c, outside }
}

function scenariosPath(f: Fixture): string {
  return `/api/workspaces/${f.wsId}/boards/${f.ctx.boardId}/sprints/${f.sprintId}/scenarios`
}

describe('POST /scenarios/simulate', () => {
  it('считает baseline, scenario и delta для exclude_task', async () => {
    const f = await setupFixture()
    const res = await fetchWithJar<ScenarioSimulationReport>(
      f.owner.jar,
      `${scenariosPath(f)}/simulate`,
      { method: 'POST', body: { changes: [{ type: 'exclude_task', taskId: f.c }] } },
    )
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      expect(res.body.scenario.remainingCount).toBe(res.body.baseline.remainingCount - 1)
      expect(res.body.delta.p50Days).toBeGreaterThan(0)
      expect(res.body.scenario.tasks.some(t => t.taskId === f.c)).toBe(false)
    }
  })

  it('shift_deadline меняет только вероятность, не длительности', async () => {
    const f = await setupFixture()
    const res = await fetchWithJar<ScenarioSimulationReport>(
      f.owner.jar,
      `${scenariosPath(f)}/simulate`,
      { method: 'POST', body: { changes: [{ type: 'shift_deadline', days: 5 }] } },
    )
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      expect(res.body.scenario.simulation.p50Days).toBe(res.body.baseline.simulation.p50Days)
      expect(res.body.scenario.simulation.probabilityWithinHorizon!)
        .toBeGreaterThanOrEqual(res.body.baseline.simulation.probabilityWithinHorizon!)
    }
  })

  it('422 на add_dependency с циклом', async () => {
    const f = await setupFixture()
    const res = await fetchWithJar(
      f.owner.jar,
      `${scenariosPath(f)}/simulate`,
      { method: 'POST', body: { changes: [{ type: 'add_dependency', blockerTaskId: f.c, blockedTaskId: f.a }] } },
    )
    expect(res.status).toBe(422)
  })

  it('422 на задачу вне спринта', async () => {
    const f = await setupFixture()
    const res = await fetchWithJar(
      f.owner.jar,
      `${scenariosPath(f)}/simulate`,
      { method: 'POST', body: { changes: [{ type: 'exclude_task', taskId: f.outside }] } },
    )
    expect(res.status).toBe(422)
  })

  it('CRN: повторный simulate даёт идентичный результат', async () => {
    const f = await setupFixture()
    const body = { changes: [{ type: 'exclude_task', taskId: f.c }] }
    const r1 = await fetchWithJar<ScenarioSimulationReport>(
      f.owner.jar, `${scenariosPath(f)}/simulate`, { method: 'POST', body },
    )
    const r2 = await fetchWithJar<ScenarioSimulationReport>(
      f.owner.jar, `${scenariosPath(f)}/simulate`, { method: 'POST', body },
    )
    expect(r1.body.ok && r2.body.ok).toBe(true)
    if (r1.body.ok && r2.body.ok) {
      expect(r1.body.scenario.simulation.p50Days).toBe(r2.body.scenario.simulation.p50Days)
      expect(r1.body.scenario.simulation.p85Days).toBe(r2.body.scenario.simulation.p85Days)
    }
  })
})
