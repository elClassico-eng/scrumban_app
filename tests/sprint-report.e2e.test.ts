import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, getTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { SprintReportResponse } from '../shared/types/sprint-report'

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
    headers: { 'x-forwarded-for': `10.6.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

function sprintPath(wsId: string, boardId: string, sprintId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprintId}`
}

async function createSprintWithTasks(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  taskIds: string[],
  opts: { start?: boolean; daysFromNow?: number } = {},
) {
  const base = Date.now() + (opts.daysFromNow ?? 0) * 86_400_000
  const res = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    {
      method: 'POST',
      body: {
        name: `Sprint-${Math.random().toString(36).slice(2, 7)}`,
        plannedStartAt: new Date(base).toISOString(),
        plannedEndAt: new Date(base + 7 * 86_400_000).toISOString(),
        taskIds,
      },
    },
  )
  const id = res.body.sprint.id
  if (opts.start) {
    await fetchWithJar(actor.jar, `${sprintPath(wsId, boardId, id)}/start`, { method: 'POST' })
  }
  return id
}

describe('sprint report', () => {
  it('формируется при закрытии: итоги, цель, carry-over, immutability', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const a = await createTask(owner, wsId, boardId, columns.backlog, 'A', 3)
    const b = await createTask(owner, wsId, boardId, columns.backlog, 'B', 5)
    const c = await createTask(owner, wsId, boardId, columns.backlog, 'C', 2)
    const sId = await createSprintWithTasks(owner, wsId, boardId, [a, b, c], { start: true })

    await closeTask(owner, wsId, boardId, a, columns.done)

    const closeRes = await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, sId)}/close`, {
      method: 'POST',
      body: {
        goalAchieved: true,
        goalComment: 'Ядро готово',
        carryOver: [
          { taskId: b, decision: 'keep' },
          { taskId: c, decision: 'backlog' },
        ],
      },
    })
    expect(closeRes.status).toBe(200)

    const res = await fetchWithJar<SprintReportResponse>(
      owner.jar,
      `${sprintPath(wsId, boardId, sId)}/report`,
    )
    expect(res.status).toBe(200)
    const p = res.body.report.payload
    expect(p.goal.achieved).toBe(true)
    expect(p.goal.comment).toBe('Ядро готово')
    expect(p.totals.startCount).toBe(3)
    expect(p.totals.startSp).toBe(10)
    expect(p.totals.deliveredCount).toBe(1)
    expect(p.totals.deliveredSp).toBe(3)
    expect(p.carryOver.map(x => x.decision).sort()).toEqual(['backlog', 'keep'])
    expect(p.tasks.length).toBeGreaterThanOrEqual(3)

    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/tasks/${b}`, {
      method: 'PATCH',
      body: { storyPoints: 100 },
    })
    const res2 = await fetchWithJar<SprintReportResponse>(
      owner.jar,
      `${sprintPath(wsId, boardId, sId)}/report`,
    )
    expect(res2.body.report.payload.totals.startSp).toBe(10)
  })

  it('carry-over streak растёт при переносе через спринты', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const stuck = await createTask(owner, wsId, boardId, columns.backlog, 'Stuck', 5)

    const s1 = await createSprintWithTasks(owner, wsId, boardId, [stuck], { start: true })
    const s2 = await createSprintWithTasks(owner, wsId, boardId, [], { daysFromNow: 8 })
    await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, s1)}/close`, {
      method: 'POST',
      body: { carryOver: [{ taskId: stuck, decision: 'next_sprint' }] },
    })

    await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, s2)}/start`, { method: 'POST' })
    await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, s2)}/close`, {
      method: 'POST',
      body: { carryOver: [{ taskId: stuck, decision: 'keep' }] },
    })

    const r1 = await fetchWithJar<SprintReportResponse>(owner.jar, `${sprintPath(wsId, boardId, s1)}/report`)
    const r2 = await fetchWithJar<SprintReportResponse>(owner.jar, `${sprintPath(wsId, boardId, s2)}/report`)
    expect(r1.body.report.payload.carryOver[0]!.streak).toBe(1)
    expect(r2.body.report.payload.carryOver[0]!.streak).toBe(2)
  })

  it('legacy-бэкфилл: generate однократно, повтор 409', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprintWithTasks(owner, wsId, boardId, [], { start: true })
    await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, sId)}/close`, { method: 'POST' })

    const sql = getTestSql()
    await sql`DELETE FROM sprint_reports WHERE sprint_id = ${sId}`

    const missing = await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, sId)}/report`)
    expect(missing.status).toBe(404)

    const gen = await fetchWithJar<SprintReportResponse>(
      owner.jar,
      `${sprintPath(wsId, boardId, sId)}/report/generate`,
      { method: 'POST' },
    )
    expect(gen.status).toBe(200)

    const again = await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, sId)}/report/generate`, {
      method: 'POST',
    })
    expect(again.status).toBe(409)
  })

  it('RBAC и RLS: viewer читает, member не генерирует, чужак 404', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)
    const sId = await createSprintWithTasks(owner, wsId, boardId, [], { start: true })
    await fetchWithJar(owner.jar, `${sprintPath(wsId, boardId, sId)}/close`, { method: 'POST' })

    const viewer = await registerUser('viewer@example.com')
    await inviteMember(owner, wsId, viewer.email, 'viewer')
    const viewerRes = await fetchWithJar(viewer.jar, `${sprintPath(wsId, boardId, sId)}/report`)
    expect(viewerRes.status).toBe(200)

    const sql = getTestSql()
    await sql`DELETE FROM sprint_reports WHERE sprint_id = ${sId}`
    const member = await registerUser('member@example.com')
    await inviteMember(owner, wsId, member.email, 'member')
    const denied = await fetchWithJar(member.jar, `${sprintPath(wsId, boardId, sId)}/report/generate`, {
      method: 'POST',
    })
    expect(denied.status).toBe(403)

    const stranger = await registerUser('stranger@example.com')
    const strangerRes = await fetchWithJar(stranger.jar, `${sprintPath(wsId, boardId, sId)}/report`)
    expect(strangerRes.status).toBe(404)
  })
})
