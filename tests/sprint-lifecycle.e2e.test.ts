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
    headers: { 'x-forwarded-for': `10.4.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

async function createTask(actor: UserCtx, wsId: string, boardId: string, columnId: string, title: string) {
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
  opts: { start?: boolean; daysFromNow?: number } = {},
) {
  const base = Date.now() + (opts.daysFromNow ?? 0) * 86_400_000
  const res = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    {
      method: 'POST',
      body: {
        name,
        plannedStartAt: new Date(base).toISOString(),
        plannedEndAt: new Date(base + 7 * 86_400_000).toISOString(),
      },
    },
  )
  const id = res.body.sprint.id
  if (opts.start) {
    await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${id}/start`, {
      method: 'POST',
    })
  }
  return id
}

async function addToSprint(actor: UserCtx, wsId: string, boardId: string, sprintId: string, taskId: string) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprintId}/tasks`, {
    method: 'POST',
    body: { taskId },
  })
}

function sprintPath(wsId: string, boardId: string, sprintId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprintId}`
}

describe('event trail', () => {
  it('add/remove membership пишут события в task_events', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog, 'T1')
    const sId = await createSprint(owner, wsId, boardId, 'S1')

    await addToSprint(owner, wsId, boardId, sId, taskId)
    await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, sId)}/tasks/${taskId}`, {
      method: 'DELETE',
    })

    const sql = getTestSql()
    const rows = await sql`
      SELECT event_type, payload FROM task_events
      WHERE task_id = ${taskId} AND event_type IN ('task_added_to_sprint','task_removed_from_sprint')
      ORDER BY created_at
    `
    expect(rows.map(r => r.event_type)).toEqual(['task_added_to_sprint', 'task_removed_from_sprint'])
    expect(rows[0]!.payload.sprintId).toBe(sId)
  })

  it('blockedReason переходы пишут task_blocked/task_unblocked', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const taskId = await createTask(owner, wsId, boardId, columns.backlog, 'T1')

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: { blockedReason: 'Ждём ревью' },
    })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: { blockedReason: null },
    })

    const sql = getTestSql()
    const rows = await sql`
      SELECT event_type, payload FROM task_events
      WHERE task_id = ${taskId} AND event_type IN ('task_blocked','task_unblocked')
      ORDER BY created_at
    `
    expect(rows.map(r => r.event_type)).toEqual(['task_blocked', 'task_unblocked'])
    expect(rows[0]!.payload.reason).toBe('Ждём ревью')
  })

  it('start пишет sprint_started в sprint_events', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1', { start: true })

    const sql = getTestSql()
    const rows = await sql`SELECT event_type, actor_id FROM sprint_events WHERE sprint_id = ${sId}`
    expect(rows.map(r => r.event_type)).toEqual(['sprint_started'])
    expect(rows[0]!.actor_id).toBe(owner.id)
  })
})

describe('updateSprint gates', () => {
  it('409 на редактирование закрытого спринта', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1')
    await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, sId)}/close`, { method: 'POST' })

    const res = await fetchWithJar(owner.jar, sprintPath(wsId, boardId, sId), {
      method: 'PATCH',
      body: { name: 'Hacked' },
    })
    expect(res.status).toBe(409)
  })

  it('422 на смену цели активного спринта', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1', { start: true })

    const res = await fetchWithJar(owner.jar, sprintPath(wsId, boardId, sId), {
      method: 'PATCH',
      body: { goal: 'Новая цель' },
    })
    expect(res.status).toBe(422)

    const rename = await fetchWithJar<{ sprint: { name: string; plannedEndAt: string | null } }>(
      owner.jar,
      sprintPath(wsId, boardId, sId),
      { method: 'PATCH', body: { name: 'Переименован' } },
    )
    expect(rename.status).toBe(200)
    expect(rename.body.sprint.name).toBe('Переименован')
    expect(rename.body.sprint.plannedEndAt).not.toBeNull()
  })

  it('сдвиг дат активного: 422 без причины, 200 с причиной + событие', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, 'S1', { start: true })
    const newEnd = new Date(Date.now() + 12 * 86_400_000).toISOString()

    const noReason = await fetchWithJar(owner.jar, sprintPath(wsId, boardId, sId), {
      method: 'PATCH',
      body: { plannedEndAt: newEnd },
    })
    expect(noReason.status).toBe(422)

    const withReason = await fetchWithJar(owner.jar, sprintPath(wsId, boardId, sId), {
      method: 'PATCH',
      body: { plannedEndAt: newEnd, datesChangeReason: 'Смежники задержали интеграцию' },
    })
    expect(withReason.status).toBe(200)

    const sql = getTestSql()
    const rows = await sql`
      SELECT payload FROM sprint_events WHERE sprint_id = ${sId} AND event_type = 'dates_changed'
    `
    expect(rows).toHaveLength(1)
    expect(rows[0]!.payload.reason).toBe('Смежники задержали интеграцию')
  })
})

describe('close dialog', () => {
  async function fixtureWithOpenTasks() {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'A')
    const b = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'B')
    const c = await createTask(owner, wsId, ctx.boardId, ctx.columns.backlog, 'C')
    const sId = await createSprint(owner, wsId, ctx.boardId, 'S1', { start: true })
    for (const t of [a, b, c]) await addToSprint(owner, wsId, ctx.boardId, sId, t)
    return { owner, wsId, ctx, sId, a, b, c }
  }

  it('422 когда решения покрывают не все незакрытые задачи', async () => {
    const f = await fixtureWithOpenTasks()
    const res = await fetchWithJar(f.owner.jar, `${sprintPath(f.wsId, f.ctx.boardId, f.sId)}/close`, {
      method: 'POST',
      body: { goalAchieved: false, carryOver: [{ taskId: f.a, decision: 'keep' }] },
    })
    expect(res.status).toBe(422)
  })

  it('все три решения работают, payload sprint_closed корректен', async () => {
    const f = await fixtureWithOpenTasks()
    const nextId = await createSprint(f.owner, f.wsId, f.ctx.boardId, 'S2', { daysFromNow: 8 })

    const res = await fetchWithJar(f.owner.jar, `${sprintPath(f.wsId, f.ctx.boardId, f.sId)}/close`, {
      method: 'POST',
      body: {
        goalAchieved: true,
        goalComment: 'Ядро доставлено',
        carryOver: [
          { taskId: f.a, decision: 'next_sprint' },
          { taskId: f.b, decision: 'backlog' },
          { taskId: f.c, decision: 'keep' },
        ],
      },
    })
    expect(res.status).toBe(200)

    const next = await fetchWithJar<{ tasks: unknown }>(
      f.owner.jar,
      `${sprintPath(f.wsId, f.ctx.boardId, nextId)}/tasks`,
    )
    const nextStr = JSON.stringify(next.body)
    expect(nextStr).toContain(f.a)
    expect(nextStr).not.toContain(f.b)

    const closed = await fetchWithJar<{ tasks: unknown }>(
      f.owner.jar,
      `${sprintPath(f.wsId, f.ctx.boardId, f.sId)}/tasks`,
    )
    const closedStr = JSON.stringify(closed.body)
    expect(closedStr).toContain(f.c)
    expect(closedStr).not.toContain(f.a)
    expect(closedStr).not.toContain(f.b)

    const sql = getTestSql()
    const rows = await sql`
      SELECT payload FROM sprint_events WHERE sprint_id = ${f.sId} AND event_type = 'sprint_closed'
    `
    expect(rows).toHaveLength(1)
    const payload = rows[0]!.payload
    expect(payload.goalAchieved).toBe(true)
    expect(payload.goalComment).toBe('Ядро доставлено')
    expect(payload.movedCount).toBe(1)
    expect(payload.backlogCount).toBe(1)
    expect(payload.keptCount).toBe(1)
  })

  it('next_sprint без запланированного спринта → 422', async () => {
    const f = await fixtureWithOpenTasks()
    const res = await fetchWithJar(f.owner.jar, `${sprintPath(f.wsId, f.ctx.boardId, f.sId)}/close`, {
      method: 'POST',
      body: {
        carryOver: [
          { taskId: f.a, decision: 'next_sprint' },
          { taskId: f.b, decision: 'keep' },
          { taskId: f.c, decision: 'keep' },
        ],
      },
    })
    expect(res.status).toBe(422)
  })
})

describe('createSprint with taskIds', () => {
  it('создаёт спринт с составом атомарно и пишет события', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const a = await createTask(owner, wsId, boardId, columns.backlog, 'A')
    const b = await createTask(owner, wsId, boardId, columns.backlog, 'B')

    const res = await fetchWithJar<{ sprint: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
      {
        method: 'POST',
        body: {
          name: 'Wizard sprint',
          plannedStartAt: new Date().toISOString(),
          plannedEndAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          taskIds: [a, b],
        },
      },
    )
    expect(res.status).toBe(200)
    const sId = res.body.sprint.id

    const tasksRes = await fetchWithJar<unknown>(owner.jar, `${sprintPath(wsId, boardId, sId)}/tasks`)
    const str = JSON.stringify(tasksRes.body)
    expect(str).toContain(a)
    expect(str).toContain(b)

    const sql = getTestSql()
    const events = await sql`
      SELECT task_id FROM task_events
      WHERE event_type = 'task_added_to_sprint' AND payload->>'sprintId' = ${sId}
    `
    expect(events).toHaveLength(2)
  })

  it('чужая задача → 422 и спринт не создан', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const other = await fetchWithJar<{ board: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards`,
      { method: 'POST', body: { name: 'Other', slug: 'other' } },
    )
    const otherCols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${other.body.board.id}/columns`,
    )
    const foreignTask = await createTask(
      owner, wsId, other.body.board.id,
      otherCols.body.columns.find(c => c.columnRole === 'backlog')!.id,
      'Foreign',
    )

    const res = await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints`, {
      method: 'POST',
      body: { name: 'Broken', taskIds: [foreignTask] },
    })
    expect(res.status).toBe(422)

    const sql = getTestSql()
    const sprints = await sql`SELECT id FROM sprints WHERE board_id = ${boardId}`
    expect(sprints).toHaveLength(0)
  })
})
