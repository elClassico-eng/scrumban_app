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
    headers: { 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
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

async function createBoard(actor: UserCtx, wsId: string) {
  const board = await fetchWithJar<{ board: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards`,
    { method: 'POST', body: { name: 'Main', slug: 'main' } },
  )
  return board.body.board.id
}

async function createSprint(
  actor: UserCtx,
  wsId: string,
  boardId: string,
  opts: { start?: boolean; close?: boolean; daysFromNow?: number } = {},
) {
  const base = Date.now() + (opts.daysFromNow ?? 0) * 86_400_000
  const res = await fetchWithJar<{ sprint: { id: string } }>(
    actor.jar,
    `/api/workspaces/${wsId}/boards/${boardId}/sprints`,
    {
      method: 'POST',
      body: {
        name: `S-${Math.random().toString(36).slice(2, 6)}`,
        plannedStartAt: new Date(base).toISOString(),
        plannedEndAt: new Date(base + 7 * 86_400_000).toISOString(),
      },
    },
  )
  const id = res.body.sprint.id
  if (opts.start || opts.close) {
    await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${id}/start`, { method: 'POST' })
  }
  if (opts.close) {
    await fetchWithJar(actor.jar, `/api/workspaces/${wsId}/boards/${boardId}/sprints/${id}/close`, { method: 'POST' })
  }
  return id
}

function retroPath(wsId: string, boardId: string, sprintId: string) {
  return `/api/workspaces/${wsId}/boards/${boardId}/sprints/${sprintId}/retro`
}

type Note = { id: string; category: string; body: string; isResolved: boolean; convertedTaskId: string | null; taskId: string | null }

describe('sprint retro', () => {
  it('CRUD + resolve: member создаёт, admin правит чужую, member не правит чужую', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, { close: true })

    const created = await fetchWithJar<{ note: Note }>(owner.jar, retroPath(wsId, boardId, sId), {
      method: 'POST',
      body: { category: 'to_improve', body: 'Долго ждали ревью' },
    })
    expect(created.status).toBe(201)
    const noteId = created.body.note.id

    const member = await registerUser('member@example.com')
    await inviteMember(owner, wsId, member.email, 'member')
    const memberPatch = await fetchWithJar(member.jar, `${retroPath(wsId, boardId, sId)}/${noteId}`, {
      method: 'PATCH',
      body: { body: 'hack' },
    })
    expect(memberPatch.status).toBe(403)

    const resolve = await fetchWithJar<{ note: Note }>(member.jar, `${retroPath(wsId, boardId, sId)}/${noteId}`, {
      method: 'PATCH',
      body: { isResolved: true },
    })
    expect(resolve.status).toBe(200)
    expect(resolve.body.note.isResolved).toBe(true)

    const admin = await registerUser('admin@example.com')
    await inviteMember(owner, wsId, admin.email, 'admin')
    const adminPatch = await fetchWithJar<{ note: Note }>(admin.jar, `${retroPath(wsId, boardId, sId)}/${noteId}`, {
      method: 'PATCH',
      body: { body: 'Долго ждали ревью (уточнено)' },
    })
    expect(adminPatch.status).toBe(200)

    const viewer = await registerUser('viewer@example.com')
    await inviteMember(owner, wsId, viewer.email, 'viewer')
    const list = await fetchWithJar<{ notes: Note[] }>(viewer.jar, retroPath(wsId, boardId, sId))
    expect(list.status).toBe(200)
    expect(list.body.notes).toHaveLength(1)
    const denied = await fetchWithJar(viewer.jar, retroPath(wsId, boardId, sId), {
      method: 'POST',
      body: { category: 'went_well', body: 'x' },
    })
    expect(denied.status).toBe(403)
  })

  it('копилка: заметка на активном спринте с привязкой задачи; planned → 422', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const cols = await fetchWithJar<{ columns: { id: string; columnRole: string }[] }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/columns`,
    )
    const backlogCol = cols.body.columns.find(c => c.columnRole === 'backlog')!.id
    const task = await fetchWithJar<{ task: { id: string } }>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/tasks`,
      { method: 'POST', body: { columnId: backlogCol, title: 'Проблемная задача' } },
    )

    const active = await createSprint(owner, wsId, boardId, { start: true })
    const res = await fetchWithJar<{ note: Note }>(owner.jar, retroPath(wsId, boardId, active), {
      method: 'POST',
      body: { category: 'to_improve', body: 'Задача застряла в ревью', taskId: task.body.task.id },
    })
    expect(res.status).toBe(201)
    expect(res.body.note.taskId).toBe(task.body.task.id)

    const planned = await createSprint(owner, wsId, boardId, { daysFromNow: 10 })
    const deniedPlanned = await fetchWithJar(owner.jar, retroPath(wsId, boardId, planned), {
      method: 'POST',
      body: { category: 'went_well', body: 'x' },
    })
    expect(deniedPlanned.status).toBe(422)
  })

  it('convert: action item → задача в бэклоге + в следующий planned спринт, повтор 409', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const closed = await createSprint(owner, wsId, boardId, { close: true })
    const nextPlanned = await createSprint(owner, wsId, boardId, { daysFromNow: 10 })

    const note = await fetchWithJar<{ note: Note }>(owner.jar, retroPath(wsId, boardId, closed), {
      method: 'POST',
      body: { category: 'action_item', body: 'Настроить автотесты в CI' },
    })
    const noteId = note.body.note.id

    const conv = await fetchWithJar<{ note: Note; taskId: string; addedToSprintId: string | null }>(
      owner.jar,
      `${retroPath(wsId, boardId, closed)}/${noteId}/convert`,
      { method: 'POST' },
    )
    expect(conv.status).toBe(200)
    expect(conv.body.note.convertedTaskId).toBe(conv.body.taskId)
    expect(conv.body.addedToSprintId).toBe(nextPlanned)

    const sprintTasks = await fetchWithJar<unknown>(
      owner.jar,
      `/api/workspaces/${wsId}/boards/${boardId}/sprints/${nextPlanned}/tasks`,
    )
    expect(JSON.stringify(sprintTasks.body)).toContain(conv.body.taskId)

    const again = await fetchWithJar(owner.jar, `${retroPath(wsId, boardId, closed)}/${noteId}/convert`, {
      method: 'POST',
    })
    expect(again.status).toBe(409)

    const wentWell = await fetchWithJar<{ note: Note }>(owner.jar, retroPath(wsId, boardId, closed), {
      method: 'POST',
      body: { category: 'went_well', body: 'Хорошо поработали' },
    })
    const wrongCat = await fetchWithJar(
      owner.jar,
      `${retroPath(wsId, boardId, closed)}/${wentWell.body.note.id}/convert`,
      { method: 'POST' },
    )
    expect(wrongCat.status).toBe(422)
  })

  it('RLS: заметки не видны постороннему', async () => {
    const owner = await registerUser('owner@example.com')
    const wsId = await createWorkspace(owner)
    const boardId = await createBoard(owner, wsId)
    const sId = await createSprint(owner, wsId, boardId, { close: true })
    await fetchWithJar(owner.jar, retroPath(wsId, boardId, sId), {
      method: 'POST',
      body: { category: 'went_well', body: 'секрет' },
    })

    const stranger = await registerUser('stranger@example.com')
    const res = await fetchWithJar(stranger.jar, retroPath(wsId, boardId, sId))
    expect(res.status).toBe(404)
  })
})
