import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { SprintActivityResponse } from '../shared/types/sprint-activity'

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
    headers: { 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

function activityPath(wsId: string, boardId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/sprint-activity`
}

describe('sprint activity feed', () => {
  it('собирает события старта, закрытия и состава спринта', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId, columns } = await createBoardWithColumns(owner, wsId)
    const task = await createTask(owner, wsId, boardId, columns.backlog, 'Задача')

    const sprint = await fetchWithJar<{ sprint: { id: string } }>(
      owner.jar,
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
    const sId = sprint.body.sprint.id
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/tasks`, {
      method: 'POST',
      body: { taskId: task },
    })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/start`, { method: 'POST' })
    await fetchWithJar(owner.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sId}/close`, {
      method: 'POST',
      body: { carryOver: [{ taskId: task, decision: 'keep' }] },
    })

    const res = await fetchWithJar<SprintActivityResponse>(owner.jar, activityPath(wsId, boardId))
    expect(res.status).toBe(200)
    const kinds = res.body.items.map(i => i.kind)
    expect(kinds).toContain('sprint_started')
    expect(kinds).toContain('sprint_closed')
    expect(kinds).toContain('task_added')
    const added = res.body.items.find(i => i.kind === 'task_added')
    expect(added!.taskTitle).toBe('Задача')
    expect(added!.sprintName).toBe('Sprint 1')
    // newest first
    const times = res.body.items.map(i => new Date(i.atISO).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('RBAC/RLS: viewer 200, чужак 404', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const { boardId } = await createBoardWithColumns(owner, wsId)

    const viewer = await registerUser('viewer@example.com')
    await inviteMember(owner, wsId, viewer.email, 'viewer')
    const viewerRes = await fetchWithJar(viewer.jar, activityPath(wsId, boardId))
    expect(viewerRes.status).toBe(200)

    const stranger = await registerUser('stranger@example.com')
    const strangerRes = await fetchWithJar(stranger.jar, activityPath(wsId, boardId))
    expect(strangerRes.status).toBe(404)
  })
})
