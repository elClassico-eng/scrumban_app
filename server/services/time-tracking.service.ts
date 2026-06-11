import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { tasks, timeEntries, type WorkspaceMemberRole } from '../db/schema'
import { withTenant } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { requireMinRole } from '../utils/rbac'

function toView(e: typeof timeEntries.$inferSelect) {
  const running = e.durationSeconds == null
  const elapsedSeconds = running
    ? Math.max(0, Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 1000))
    : e.durationSeconds!
  return { ...e, running, elapsedSeconds }
}

export async function startTimer(input: {
  workspaceId: string
  boardId: string
  taskId: string
  userId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'member')
  return withTenant(input.workspaceId, async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!task || task.boardId !== input.boardId) throw new NotFoundError('Task not found')

    await tx
      .update(timeEntries)
      .set({
        durationSeconds: sql`GREATEST(1, EXTRACT(EPOCH FROM (now() - ${timeEntries.startedAt}))::int)`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(timeEntries.userId, input.userId), isNull(timeEntries.durationSeconds)))

    const [entry] = await tx
      .insert(timeEntries)
      .values({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        userId: input.userId,
        startedAt: sql`now()`,
      })
      .returning()

    publishBoardEvent({
      type: 'time.started',
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      payload: { taskId: input.taskId },
    })

    return entry!
  })
}

export async function stopTimer(input: {
  workspaceId: string
  boardId: string
  userId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'member')
  return withTenant(input.workspaceId, async (tx) => {
    const [stopped] = await tx
      .update(timeEntries)
      .set({
        durationSeconds: sql`GREATEST(1, EXTRACT(EPOCH FROM (now() - ${timeEntries.startedAt}))::int)`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(timeEntries.userId, input.userId), isNull(timeEntries.durationSeconds)))
      .returning()

    if (stopped) {
      publishBoardEvent({
        type: 'time.stopped',
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        payload: { taskId: stopped.taskId },
      })
    }

    return stopped ?? null
  })
}

export async function getActiveTimer(input: {
  workspaceId: string
  userId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const [row] = await tx
      .select({ entry: timeEntries, taskTitle: tasks.title })
      .from(timeEntries)
      .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .where(and(eq(timeEntries.userId, input.userId), isNull(timeEntries.durationSeconds)))

    if (!row) return null

    return {
      entry: toView(row.entry),
      taskTitle: row.taskTitle,
      taskShortId: row.entry.taskId.slice(0, 6).toUpperCase(),
    }
  })
}

export async function listTaskEntries(input: {
  workspaceId: string
  boardId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const rows = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.taskId, input.taskId))
      .orderBy(desc(timeEntries.startedAt))

    return {
      entries: rows.map(toView),
      totalSeconds: rows.reduce((a, r) => a + (r.durationSeconds ?? 0), 0),
    }
  })
}
