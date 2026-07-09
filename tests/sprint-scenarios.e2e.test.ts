import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
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

describe('scenarios CRUD', () => {
  it('create сохраняет снимки прогнозов и возвращает 201', async () => {
    const f = await setupFixture()
    const res = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      { method: 'POST', body: { name: 'План Б', changes: [{ type: 'exclude_task', taskId: f.c }] } },
    )
    expect(res.status).toBe(201)
    expect(res.body.scenario.name).toBe('План Б')
    expect(res.body.scenario.baselineResult).not.toBeNull()
    expect(res.body.scenario.scenarioResult).not.toBeNull()
    expect(res.body.scenario.computedAt).toBeTruthy()
    expect(res.body.scenario.appliedAt).toBeNull()
  })

  it('list возвращает сценарии спринта, viewer имеет доступ, но не создаёт', async () => {
    const f = await setupFixture()
    await fetchWithJar(f.owner.jar, scenariosPath(f), {
      method: 'POST',
      body: { name: 'S1', changes: [{ type: 'exclude_task', taskId: f.c }] },
    })

    const viewer = await registerUser('viewer@example.com')
    await inviteMember(f.owner, f.wsId, viewer.email, 'viewer')

    const list = await fetchWithJar<{ scenarios: SprintScenario[] }>(viewer.jar, scenariosPath(f))
    expect(list.status).toBe(200)
    expect(list.body.scenarios).toHaveLength(1)

    const denied = await fetchWithJar(viewer.jar, scenariosPath(f), {
      method: 'POST',
      body: { name: 'S2', changes: [{ type: 'shift_deadline', days: 2 }] },
    })
    expect(denied.status).toBe(403)
  })

  it('RLS: сценарии не видны постороннему', async () => {
    const f = await setupFixture()
    const stranger = await registerUser('stranger@example.com')
    const res = await fetchWithJar(stranger.jar, scenariosPath(f))
    expect(res.status).toBe(404)
  })

  it('member не может править чужой сценарий, admin может', async () => {
    const f = await setupFixture()
    const created = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      { method: 'POST', body: { name: 'Own', changes: [{ type: 'shift_deadline', days: 2 }] } },
    )
    const scenarioId = created.body.scenario.id

    const member = await registerUser('member@example.com')
    await inviteMember(f.owner, f.wsId, member.email, 'member')
    const admin = await registerUser('admin@example.com')
    await inviteMember(f.owner, f.wsId, admin.email, 'admin')

    const memberPatch = await fetchWithJar(member.jar, `${scenariosPath(f)}/${scenarioId}`, {
      method: 'PATCH',
      body: { name: 'Hacked' },
    })
    expect(memberPatch.status).toBe(403)

    const adminPatch = await fetchWithJar<{ scenario: SprintScenario }>(
      admin.jar,
      `${scenariosPath(f)}/${scenarioId}`,
      { method: 'PATCH', body: { name: 'Renamed' } },
    )
    expect(adminPatch.status).toBe(200)
    expect(adminPatch.body.scenario.name).toBe('Renamed')
  })

  it('применённый сценарий не редактируется и не удаляется автором-member', async () => {
    const f = await setupFixture()
    const created = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      { method: 'POST', body: { name: 'Applied', changes: [{ type: 'shift_deadline', days: 2 }] } },
    )
    const scenarioId = created.body.scenario.id

    const sql = getTestSql()
    await sql`UPDATE sprint_scenarios SET applied_at = now() WHERE id = ${scenarioId}`

    const patch = await fetchWithJar(f.owner.jar, `${scenariosPath(f)}/${scenarioId}`, {
      method: 'PATCH',
      body: { name: 'Too late' },
    })
    expect(patch.status).toBe(409)
  })

  it('delete удаляет сценарий', async () => {
    const f = await setupFixture()
    const created = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      { method: 'POST', body: { name: 'Doomed', changes: [{ type: 'shift_deadline', days: 1 }] } },
    )
    const del = await fetchWithJar(f.owner.jar, `${scenariosPath(f)}/${created.body.scenario.id}`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(200)
    const list = await fetchWithJar<{ scenarios: SprintScenario[] }>(f.owner.jar, scenariosPath(f))
    expect(list.body.scenarios).toHaveLength(0)
  })
})

describe('POST /scenarios/:id/apply', () => {
  it('применяет все 4 типа изменений транзакционно', async () => {
    const f = await setupFixture()
    const created = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      {
        method: 'POST',
        body: {
          name: 'Full apply',
          changes: [
            { type: 'exclude_task', taskId: f.c },
            { type: 'reestimate_task', taskId: f.b, estimateDays: 7 },
            { type: 'remove_dependency', blockerTaskId: f.a, blockedTaskId: f.b },
            { type: 'shift_deadline', days: 3 },
          ],
        },
      },
    )
    const scenarioId = created.body.scenario.id

    const before = await fetchWithJar<{ sprint: { plannedEndAt: string } }>(
      f.owner.jar,
      `/api/workspaces/${f.wsId}/boards/${f.ctx.boardId}/sprints/${f.sprintId}`,
    )

    const res = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      `${scenariosPath(f)}/${scenarioId}/apply`,
      { method: 'POST' },
    )
    expect(res.status).toBe(200)
    expect(res.body.scenario.appliedAt).toBeTruthy()
    expect(res.body.scenario.appliedBy).toBe(f.owner.id)

    const memberships = await fetchWithJar<{ tasks: { id: string }[] }>(
      f.owner.jar,
      `/api/workspaces/${f.wsId}/boards/${f.ctx.boardId}/sprints/${f.sprintId}/tasks`,
    )
    const ids = JSON.stringify(memberships.body)
    expect(ids).toContain(f.a)
    expect(ids).toContain(f.b)
    expect(ids).not.toContain(f.c)

    const taskB = await fetchWithJar<{ task: { estimateDays: number | null } }>(
      f.owner.jar,
      `/api/workspaces/${f.wsId}/boards/${f.ctx.boardId}/tasks/${f.b}`,
    )
    expect(taskB.body.task.estimateDays).toBe(7)

    const depsB = await fetchWithJar<{ blockers: unknown[]; blocks: unknown[] }>(
      f.owner.jar,
      `/api/workspaces/${f.wsId}/boards/${f.ctx.boardId}/tasks/${f.b}/dependencies`,
    )
    expect(depsB.body.blockers).toHaveLength(0)

    const after = await fetchWithJar<{ sprint: { plannedEndAt: string } }>(
      f.owner.jar,
      `/api/workspaces/${f.wsId}/boards/${f.ctx.boardId}/sprints/${f.sprintId}`,
    )
    const shiftMs = new Date(after.body.sprint.plannedEndAt).getTime()
      - new Date(before.body.sprint.plannedEndAt).getTime()
    expect(shiftMs).toBe(3 * 86_400_000)
  })

  it('403 для member, 200 для scrum_master', async () => {
    const f = await setupFixture()
    const created = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      { method: 'POST', body: { name: 'SM only', changes: [{ type: 'shift_deadline', days: 1 }] } },
    )
    const scenarioId = created.body.scenario.id

    const member = await registerUser('member2@example.com')
    await inviteMember(f.owner, f.wsId, member.email, 'member')
    const sm = await registerUser('sm@example.com')
    await inviteMember(f.owner, f.wsId, sm.email, 'scrum_master')

    const denied = await fetchWithJar(member.jar, `${scenariosPath(f)}/${scenarioId}/apply`, { method: 'POST' })
    expect(denied.status).toBe(403)

    const ok = await fetchWithJar(sm.jar, `${scenariosPath(f)}/${scenarioId}/apply`, { method: 'POST' })
    expect(ok.status).toBe(200)
  })

  it('409 на повторный apply', async () => {
    const f = await setupFixture()
    const created = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      { method: 'POST', body: { name: 'Twice', changes: [{ type: 'shift_deadline', days: 1 }] } },
    )
    const scenarioId = created.body.scenario.id
    await fetchWithJar(f.owner.jar, `${scenariosPath(f)}/${scenarioId}/apply`, { method: 'POST' })
    const second = await fetchWithJar(f.owner.jar, `${scenariosPath(f)}/${scenarioId}/apply`, { method: 'POST' })
    expect(second.status).toBe(409)
  })

  it('409 когда сценарий протух (задача уже вне спринта)', async () => {
    const f = await setupFixture()
    const created = await fetchWithJar<{ scenario: SprintScenario }>(
      f.owner.jar,
      scenariosPath(f),
      { method: 'POST', body: { name: 'Stale', changes: [{ type: 'exclude_task', taskId: f.c }] } },
    )
    const scenarioId = created.body.scenario.id

    await fetchWithJar(
      f.owner.jar,
      `/api/workspaces/${f.wsId}/boards/${f.ctx.boardId}/sprints/${f.sprintId}/tasks/${f.c}`,
      { method: 'DELETE' },
    )

    const res = await fetchWithJar(f.owner.jar, `${scenariosPath(f)}/${scenarioId}/apply`, { method: 'POST' })
    expect(res.status).toBe(409)

    const list = await fetchWithJar<{ scenarios: SprintScenario[] }>(f.owner.jar, scenariosPath(f))
    expect(list.body.scenarios[0]!.appliedAt).toBeNull()
  })
})
