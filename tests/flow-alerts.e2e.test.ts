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
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await fetchWithJar<{ task: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
    { method: 'POST', body: { columnId, title: 'T', ...extra } },
  )
  return res.body.task.id
}

interface TaskResult {
  result: { result: string; scanned: number; emitted: number }
}

async function runFlowTask(
  actor: UserCtx,
  name:
    | 'notifications:check-sle-breaches'
    | 'notifications:check-replenishment'
    | 'notifications:check-sprint-forecast',
): Promise<TaskResult['result']> {
  const res = await fetchWithJar<TaskResult>(
    actor.jar,
    `/api/_dev/tasks/${encodeURIComponent(name)}/run`,
    { method: 'POST', body: {} },
  )
  expect(res.status).toBe(200)
  return res.body.result
}

describe('flow-alerts: SLE breach', () => {
  it('does not emit when task is fresh (age < 85% of SLE)', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(`UPDATE boards SET sle_days = 10 WHERE id = '${boardId}'`)
    await createTask(owner, wsId, boardId, columns.in_progress, { assigneeId: dev.id })

    const result = await runFlowTask(owner, 'notifications:check-sle-breaches')
    expect(result.emitted).toBe(0)
  })

  it('emits when task age crosses 85% of board SLE', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(`UPDATE boards SET sle_days = 10 WHERE id = '${boardId}'`)
    const taskId = await createTask(owner, wsId, boardId, columns.in_progress, {
      assigneeId: dev.id,
    })
    await sql.unsafe(
      `UPDATE tasks SET created_at = now() - interval '9 days' WHERE id = '${taskId}'`,
    )

    const result = await runFlowTask(owner, 'notifications:check-sle-breaches')
    expect(result.emitted).toBe(1)

    const res = await fetchWithJar<{
      notifications: { type: string; payload: { taskId: string; agePct: number } }[]
    }>(dev.jar, '/api/notifications?unread=true')
    const breach = res.body.notifications.find(n => n.type === 'sle_breach')
    expect(breach).toBeTruthy()
    expect(breach!.payload.taskId).toBe(taskId)
    expect(breach!.payload.agePct).toBeGreaterThanOrEqual(85)
  })

  it('is idempotent within 24h dedupe window', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(`UPDATE boards SET sle_days = 10 WHERE id = '${boardId}'`)
    const taskId = await createTask(owner, wsId, boardId, columns.in_progress, {
      assigneeId: dev.id,
    })
    await sql.unsafe(
      `UPDATE tasks SET created_at = now() - interval '9 days' WHERE id = '${taskId}'`,
    )

    const first = await runFlowTask(owner, 'notifications:check-sle-breaches')
    const second = await runFlowTask(owner, 'notifications:check-sle-breaches')
    expect(first.emitted).toBe(1)
    expect(second.emitted).toBe(0)

    const res = await fetchWithJar<{ notifications: { type: string }[] }>(
      dev.jar,
      '/api/notifications',
    )
    expect(res.body.notifications.filter(n => n.type === 'sle_breach').length).toBe(1)
  })

  it('skips tasks in done column even if old', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(`UPDATE boards SET sle_days = 10 WHERE id = '${boardId}'`)
    const taskId = await createTask(owner, wsId, boardId, columns.done, { assigneeId: dev.id })
    await sql.unsafe(
      `UPDATE tasks SET created_at = now() - interval '30 days', closed_at = now() WHERE id = '${taskId}'`,
    )

    const result = await runFlowTask(owner, 'notifications:check-sle-breaches')
    expect(result.emitted).toBe(0)
  })

  it('skips boards without SLE configured', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.in_progress, {
      assigneeId: dev.id,
    })
    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE tasks SET created_at = now() - interval '30 days' WHERE id = '${taskId}'`,
    )

    const result = await runFlowTask(owner, 'notifications:check-sle-breaches')
    expect(result.emitted).toBe(0)
  })

  it('uses latest task_moved event when present, not task.createdAt', async () => {
    const owner = await registerUser('owner@example.com')
    const dev = await registerUser('dev@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'dev@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(`UPDATE boards SET sle_days = 10 WHERE id = '${boardId}'`)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog, { assigneeId: dev.id })
    await sql.unsafe(
      `UPDATE tasks SET created_at = now() - interval '30 days' WHERE id = '${taskId}'`,
    )
    await fetchWithJar(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`,
      { method: 'POST', body: { toColumnId: columns.in_progress, toPosition: 0 } },
    )

    const result = await runFlowTask(owner, 'notifications:check-sle-breaches')
    expect(result.emitted).toBe(0)
  })
})

describe('flow-alerts: replenishment overdue', () => {
  it('emits when last_replenishment_at + period < now', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE boards SET last_replenishment_at = now() - interval '10 days', replenishment_period_days = 7 WHERE id = '${boardId}'`,
    )

    const result = await runFlowTask(owner, 'notifications:check-replenishment')
    expect(result.emitted).toBe(1)

    const res = await fetchWithJar<{
      notifications: { type: string; payload: { boardId: string; daysOverdue: number } }[]
    }>(owner.jar, '/api/notifications')
    const overdue = res.body.notifications.find(n => n.type === 'replenishment_overdue')
    expect(overdue).toBeTruthy()
    expect(overdue!.payload.boardId).toBe(boardId)
    expect(overdue!.payload.daysOverdue).toBeGreaterThanOrEqual(2)
  })

  it('does not emit when within the replenishment period', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE boards SET last_replenishment_at = now() - interval '3 days', replenishment_period_days = 7 WHERE id = '${boardId}'`,
    )

    const result = await runFlowTask(owner, 'notifications:check-replenishment')
    expect(result.emitted).toBe(0)
  })

  it('skips boards never replenished (no baseline yet)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    await createBoardWithColumns(owner, wsId)

    const result = await runFlowTask(owner, 'notifications:check-replenishment')
    expect(result.emitted).toBe(0)
  })

  it('notifies all admin/scrum_master/owner members, not regular members', async () => {
    const owner = await registerUser('owner@example.com')
    const admin = await registerUser('admin@example.com')
    const sm = await registerUser('sm@example.com')
    const member = await registerUser('member@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'admin@example.com', 'admin')
    await addMember(owner, wsId, 'sm@example.com', 'scrum_master')
    await addMember(owner, wsId, 'member@example.com', 'member')
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE boards SET last_replenishment_at = now() - interval '10 days', replenishment_period_days = 7 WHERE id = '${boardId}'`,
    )

    const result = await runFlowTask(owner, 'notifications:check-replenishment')
    expect(result.emitted).toBe(3)

    const memberNotifs = await fetchWithJar<{ notifications: { type: string }[] }>(
      member.jar,
      '/api/notifications',
    )
    expect(memberNotifs.body.notifications.filter(n => n.type === 'replenishment_overdue').length).toBe(0)

    for (const user of [owner, admin, sm]) {
      const res = await fetchWithJar<{ notifications: { type: string }[] }>(
        user.jar,
        '/api/notifications',
      )
      expect(res.body.notifications.filter(n => n.type === 'replenishment_overdue').length).toBe(1)
    }
  })

  it('is idempotent within 24h dedupe window', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE boards SET last_replenishment_at = now() - interval '10 days', replenishment_period_days = 7 WHERE id = '${boardId}'`,
    )

    const first = await runFlowTask(owner, 'notifications:check-replenishment')
    const second = await runFlowTask(owner, 'notifications:check-replenishment')
    expect(first.emitted).toBe(1)
    expect(second.emitted).toBe(0)
  })
})

async function createAndStartSprint(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  daysAhead: number,
): Promise<string> {
  const created = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    { method: 'POST', body: { name: 'S1' } },
  )
  const sprintId = created.body.sprint.id

  const sql = getTestSql()
  const endIso = new Date(Date.now() + daysAhead * 86_400_000).toISOString()
  await sql.unsafe(
    `UPDATE sprints SET state = 'active', started_at = now(), planned_end_at = '${endIso}' WHERE id = '${sprintId}'`,
  )
  return sprintId
}

async function attachTaskToSprint(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  sprintId: string,
  taskId: string,
): Promise<void> {
  await fetchWithJar(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprintId}/tasks`,
    { method: 'POST', body: { taskId } },
  )
}

describe('flow-alerts: sprint forecast drop', () => {
  it('emits when Monte Carlo probability falls below 70%', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)

    const seedTaskId = await createTask(owner, wsId, boardId, columns.backlog)
    const sql = getTestSql()
    await sql.unsafe(
      `INSERT INTO task_events (workspace_id, task_id, event_type, to_column_id, actor_id, created_at)
       VALUES ('${wsId}', '${seedTaskId}', 'task_closed', '${columns.done}', '${owner.id}', now() - interval '5 days')`,
    )

    const sprintId = await createAndStartSprint(owner, wsId, boardId, 1)
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      ids.push(await createTask(owner, wsId, boardId, columns.backlog))
    }
    for (const id of ids) await attachTaskToSprint(owner, wsId, boardId, sprintId, id)

    const result = await runFlowTask(owner, 'notifications:check-sprint-forecast')
    expect(result.emitted).toBeGreaterThanOrEqual(1)

    const res = await fetchWithJar<{
      notifications: { type: string; payload: { sprintId: string; probability: number } }[]
    }>(owner.jar, '/api/notifications')
    const notif = res.body.notifications.find(n => n.type === 'sprint_forecast_drop')
    expect(notif).toBeTruthy()
    expect(notif!.payload.sprintId).toBe(sprintId)
    expect(notif!.payload.probability).toBeLessThan(0.70)
  })

  it('skips sprint with no remaining tasks', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    await createAndStartSprint(owner, wsId, boardId, 5)

    const result = await runFlowTask(owner, 'notifications:check-sprint-forecast')
    expect(result.emitted).toBe(0)
  })

  it('skips sprint whose deadline has passed', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog)
    const sprintId = await createAndStartSprint(owner, wsId, boardId, 5)
    await attachTaskToSprint(owner, wsId, boardId, sprintId, taskId)

    const sql = getTestSql()
    await sql.unsafe(
      `UPDATE sprints SET planned_end_at = now() - interval '1 day' WHERE id = '${sprintId}'`,
    )

    const result = await runFlowTask(owner, 'notifications:check-sprint-forecast')
    expect(result.emitted).toBe(0)
  })

  it('skips when board has no throughput history (insufficient_data)', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const sprintId = await createAndStartSprint(owner, wsId, boardId, 5)
    for (let i = 0; i < 3; i++) {
      const tid = await createTask(owner, wsId, boardId, columns.backlog)
      await attachTaskToSprint(owner, wsId, boardId, sprintId, tid)
    }

    const result = await runFlowTask(owner, 'notifications:check-sprint-forecast')
    expect(result.emitted).toBe(0)
  })

  it('is idempotent within 24h dedupe window', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const seedTaskId = await createTask(owner, wsId, boardId, columns.backlog)
    const sql = getTestSql()
    await sql.unsafe(
      `INSERT INTO task_events (workspace_id, task_id, event_type, to_column_id, actor_id, created_at)
       VALUES ('${wsId}', '${seedTaskId}', 'task_closed', '${columns.done}', '${owner.id}', now() - interval '5 days')`,
    )
    const sprintId = await createAndStartSprint(owner, wsId, boardId, 1)
    for (let i = 0; i < 5; i++) {
      const tid = await createTask(owner, wsId, boardId, columns.backlog)
      await attachTaskToSprint(owner, wsId, boardId, sprintId, tid)
    }

    const first = await runFlowTask(owner, 'notifications:check-sprint-forecast')
    const second = await runFlowTask(owner, 'notifications:check-sprint-forecast')
    expect(first.emitted).toBeGreaterThanOrEqual(1)
    expect(second.emitted).toBe(0)
  })

  it('only notifies owner/admin/scrum_master, not regular members', async () => {
    const owner = await registerUser('owner@example.com')
    const member = await registerUser('member@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'member@example.com', 'member')
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const seedTaskId = await createTask(owner, wsId, boardId, columns.backlog)
    const sql = getTestSql()
    await sql.unsafe(
      `INSERT INTO task_events (workspace_id, task_id, event_type, to_column_id, actor_id, created_at)
       VALUES ('${wsId}', '${seedTaskId}', 'task_closed', '${columns.done}', '${owner.id}', now() - interval '5 days')`,
    )
    const sprintId = await createAndStartSprint(owner, wsId, boardId, 1)
    for (let i = 0; i < 5; i++) {
      const tid = await createTask(owner, wsId, boardId, columns.backlog)
      await attachTaskToSprint(owner, wsId, boardId, sprintId, tid)
    }

    await runFlowTask(owner, 'notifications:check-sprint-forecast')

    const memberRes = await fetchWithJar<{ notifications: { type: string }[] }>(
      member.jar,
      '/api/notifications',
    )
    expect(memberRes.body.notifications.filter(n => n.type === 'sprint_forecast_drop').length).toBe(0)

    const ownerRes = await fetchWithJar<{ notifications: { type: string }[] }>(
      owner.jar,
      '/api/notifications',
    )
    expect(ownerRes.body.notifications.filter(n => n.type === 'sprint_forecast_drop').length).toBe(1)
  })
})

describe('flow-alerts: dev endpoint security', () => {
  it('rejects unknown task name (404)', async () => {
    const owner = await registerUser('owner@example.com')
    await createWorkspace(owner)

    const res = await fetchWithJar(owner.jar, '/api/_dev/tasks/notifications:bogus/run', {
      method: 'POST',
      body: {},
    })
    expect(res.status).toBe(404)
  })

  it('rejects user with no admin/owner role anywhere (403)', async () => {
    const owner = await registerUser('owner@example.com')
    const viewer = await registerUser('viewer@example.com')
    const wsId = await createWorkspace(owner)
    await addMember(owner, wsId, 'viewer@example.com', 'viewer')

    const res = await fetchWithJar(
      viewer.jar,
      `/api/_dev/tasks/${encodeURIComponent('notifications:check-sle-breaches')}/run`,
      { method: 'POST', body: {} },
    )
    expect(res.status).toBe(403)
  })
})
