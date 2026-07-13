import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { DailyDigest } from '../shared/types/daily'

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
    headers: { 'x-forwarded-for': `10.8.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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
  await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/members`, { method: 'POST', body: { email, role } })
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

async function moveTask(actor: UserCtx, wsId: string, boardId: string, taskId: string, toColumnId: string) {
  await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: { toColumnId, toPosition: 0 },
  })
}

async function seedHistory(actor: UserCtx, wsId: string, ctx: Awaited<ReturnType<typeof createBoardWithColumns>>, count: number) {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const id = await createTask(actor, wsId, ctx.boardId, ctx.columns.backlog, `hist-${i}`)
    ids.push(id)
  }
  // Backdate the task_created events so historical cycle time is ~2 days,
  // giving a non-trivial P85 (instant create→close would make P85 ≈ 0).
  const sql = getTestSql()
  await sql`UPDATE task_events SET created_at = created_at - interval '2 days'
            WHERE event_type = 'task_created' AND task_id = ANY(${ids})`
  for (const id of ids) {
    await moveTask(actor, wsId, ctx.boardId, id, ctx.columns.done)
  }
}

function dailyPath(wsId: string, boardId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/daily`
}

describe('daily digest', () => {
  it('done считает закрытия за окно и дельту, changeItems без акторов', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    const a = await createTask(owner, wsId, ctx.boardId, ctx.columns.in_progress, 'A')
    await moveTask(owner, wsId, ctx.boardId, a, ctx.columns.done)

    const res = await fetchWithJar<DailyDigest>(owner.jar, dailyPath(wsId, ctx.boardId))
    expect(res.status).toBe(200)
    expect(res.body.stats.done.value).toBe(1)
    expect(res.body.changes.closed).toBe(1)
    expect(res.body.changeItems.some(c => c.kind === 'closed')).toBe(true)
    expect(JSON.stringify(res.body.changeItems)).not.toContain('actorId')
  })

  it('aging: старая задача в рабочей колонке попадает, свежая — нет', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    // история из быстрых задач → низкий P85
    await seedHistory(owner, wsId, ctx, 6)

    const oldTask = await createTask(owner, wsId, ctx.boardId, ctx.columns.in_progress, 'Старая')
    const fresh = await createTask(owner, wsId, ctx.boardId, ctx.columns.in_progress, 'Свежая')

    const sql = getTestSql()
    await sql`UPDATE tasks SET created_at = now() - interval '30 days' WHERE id = ${oldTask}`

    const res = await fetchWithJar<DailyDigest>(owner.jar, dailyPath(wsId, ctx.boardId))
    expect(res.body.p85Days).not.toBeNull()
    const agingIds = res.body.aging.map(a => a.taskId)
    expect(agingIds).toContain(oldTask)
    expect(agingIds).not.toContain(fresh)
    const overdueTotal = res.body.heatmap.reduce((acc, r) => acc + r.overdue, 0)
    expect(overdueTotal).toBeGreaterThanOrEqual(1)
  })

  it('блокеры со сроком и WIP-нарушение', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    const t1 = await createTask(owner, wsId, ctx.boardId, ctx.columns.in_progress, 'Заблокированная')
    const t2 = await createTask(owner, wsId, ctx.boardId, ctx.columns.in_progress, 'Вторая')

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/tasks/${t1}`, {
      method: 'PATCH',
      body: { blockedReason: 'Ждём смежников' },
    })

    // WIP limit 1 на in_progress
    const colId = ctx.columns.in_progress
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/columns/${colId}`, {
      method: 'PATCH',
      body: { wipLimit: 1 },
    })

    const res = await fetchWithJar<DailyDigest>(owner.jar, dailyPath(wsId, ctx.boardId))
    expect(res.body.stats.blocked.value).toBe(1)
    expect(res.body.blockers.map(b => b.taskId)).toContain(t1)
    expect(res.body.blockers[0]!.reason).toBe('Ждём смежников')
    const violation = res.body.wipViolations.find(v => v.columnId === colId)
    expect(violation).toBeDefined()
    expect(violation!.count).toBe(2)
    expect(violation!.limit).toBe(1)
    expect(t2).toBeDefined()
  })

  it('sprint risk: aging-задача в активном спринте', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)
    await seedHistory(owner, wsId, ctx, 6)
    const stuck = await createTask(owner, wsId, ctx.boardId, ctx.columns.in_progress, 'Застряла')
    const sql = getTestSql()
    await sql`UPDATE tasks SET created_at = now() - interval '30 days' WHERE id = ${stuck}`

    const sprint = await fetchWithJar<{ sprint: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints`,
      {
        method: 'POST',
        body: {
          name: 'S1',
          plannedStartAt: new Date().toISOString(),
          plannedEndAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          taskIds: [stuck],
        },
      },
    )
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${ctx.boardId}/sprints/${sprint.body.sprint.id}/start`, { method: 'POST' })

    const res = await fetchWithJar<DailyDigest>(owner.jar, dailyPath(wsId, ctx.boardId))
    expect(res.body.sprintRisk).not.toBeNull()
    expect(res.body.sprintRisk!.atRisk.map(r => r.taskId)).toContain(stuck)
    expect(res.body.sprintRisk!.horizonDays).toBeGreaterThan(0)
  })

  it('RBAC/RLS: viewer 200, чужак 404', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const ctx = await createBoardWithColumns(owner, wsId)

    const viewer = await registerUser('viewer@example.com')
    await inviteMember(owner, wsId, viewer.email, 'viewer')
    const viewerRes = await fetchWithJar(viewer.jar, dailyPath(wsId, ctx.boardId))
    expect(viewerRes.status).toBe(200)

    const stranger = await registerUser('stranger@example.com')
    const strangerRes = await fetchWithJar(stranger.jar, dailyPath(wsId, ctx.boardId))
    expect(strangerRes.status).toBe(404)
  })
})
