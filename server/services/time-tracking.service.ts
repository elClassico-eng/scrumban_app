import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { sprints, sprintTasks, tasks, timeEntries, type WorkspaceMemberRole } from '../db/schema'
import { withTenant } from '../utils/db'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { requireMinRole, roleAtLeast } from '../utils/rbac'

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
  const entry = await withTenant(input.workspaceId, async (tx) => {
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

    const [created] = await tx
      .insert(timeEntries)
      .values({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        userId: input.userId,
        startedAt: sql`now()`,
      })
      .returning()

    return created!
  })

  publishBoardEvent({
    type: 'time.started',
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    payload: { taskId: input.taskId },
  })

  return entry
}

export async function stopTimer(input: {
  workspaceId: string
  boardId: string
  taskId: string
  userId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'member')
  const stopped = await withTenant(input.workspaceId, async (tx) => {
    const [row] = await tx
      .update(timeEntries)
      .set({
        durationSeconds: sql`GREATEST(1, EXTRACT(EPOCH FROM (now() - ${timeEntries.startedAt}))::int)`,
        updatedAt: sql`now()`,
      })
      .where(and(
        eq(timeEntries.userId, input.userId),
        eq(timeEntries.taskId, input.taskId),
        isNull(timeEntries.durationSeconds),
      ))
      .returning()
    return row ?? null
  })

  if (stopped) {
    publishBoardEvent({
      type: 'time.stopped',
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      payload: { taskId: stopped.taskId },
    })
  }

  return stopped
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

export async function createManualEntry(input: {
  workspaceId: string
  boardId: string
  taskId: string
  userId: string
  actorRole: WorkspaceMemberRole
  startedAt: string
  durationSeconds: number
  description?: string | null
}) {
  requireMinRole(input.actorRole, 'member')
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0)
    throw new ValidationError('durationSeconds must be a positive integer')
  const entry = await withTenant(input.workspaceId, async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!task || task.boardId !== input.boardId) throw new NotFoundError('Task not found')
    const [created] = await tx
      .insert(timeEntries)
      .values({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        userId: input.userId,
        startedAt: new Date(input.startedAt),
        durationSeconds: input.durationSeconds,
        description: input.description ?? null,
      })
      .returning()
    return created!
  })
  publishBoardEvent({
    type: 'time.updated',
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    payload: { taskId: input.taskId },
  })
  return entry
}

export async function updateEntry(input: {
  workspaceId: string
  boardId: string
  entryId: string
  actorId: string
  actorRole: WorkspaceMemberRole
  patch: { startedAt?: string; durationSeconds?: number; description?: string | null }
}) {
  requireMinRole(input.actorRole, 'member')
  const updated = await withTenant(input.workspaceId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, input.entryId))
    if (!existing) throw new NotFoundError('Entry not found')
    if (existing.userId !== input.actorId && !roleAtLeast(input.actorRole, 'scrum_master'))
      throw new ForbiddenError("Cannot edit another user's entry")
    if (existing.durationSeconds == null) throw new ValidationError('Cannot edit a running entry')
    if (
      input.patch.durationSeconds != null &&
      (!Number.isInteger(input.patch.durationSeconds) || input.patch.durationSeconds <= 0)
    )
      throw new ValidationError('durationSeconds must be a positive integer')
    const [row] = await tx
      .update(timeEntries)
      .set({
        startedAt: input.patch.startedAt ? new Date(input.patch.startedAt) : existing.startedAt,
        durationSeconds: input.patch.durationSeconds ?? existing.durationSeconds,
        description:
          input.patch.description !== undefined ? input.patch.description : existing.description,
        updatedAt: sql`now()`,
      })
      .where(eq(timeEntries.id, input.entryId))
      .returning()
    return { row: row!, taskId: existing.taskId }
  })
  publishBoardEvent({
    type: 'time.updated',
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    payload: { taskId: updated.taskId },
  })
  return updated.row
}

export async function deleteEntry(input: {
  workspaceId: string
  boardId: string
  entryId: string
  actorId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'member')
  const taskId = await withTenant(input.workspaceId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, input.entryId))
    if (!existing) throw new NotFoundError('Entry not found')
    if (existing.userId !== input.actorId && !roleAtLeast(input.actorRole, 'scrum_master'))
      throw new ForbiddenError("Cannot delete another user's entry")
    await tx.delete(timeEntries).where(eq(timeEntries.id, input.entryId))
    return existing.taskId
  })
  publishBoardEvent({
    type: 'time.updated',
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    payload: { taskId },
  })
}

export async function timeReport(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const byUser = await tx
      .select({
        userId: timeEntries.userId,
        totalSeconds: sql<number>`COALESCE(SUM(${timeEntries.durationSeconds}),0)::int`,
      })
      .from(timeEntries)
      .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .where(and(eq(tasks.boardId, input.boardId), isNotNull(timeEntries.durationSeconds)))
      .groupBy(timeEntries.userId)

    const bySprint = await tx
      .select({
        sprintId: sprints.id,
        sprintName: sprints.name,
        totalSeconds: sql<number>`COALESCE(SUM(${timeEntries.durationSeconds}),0)::int`,
      })
      .from(timeEntries)
      .innerJoin(sprintTasks, eq(sprintTasks.taskId, timeEntries.taskId))
      .innerJoin(sprints, eq(sprints.id, sprintTasks.sprintId))
      .where(and(eq(sprints.boardId, input.boardId), isNotNull(timeEntries.durationSeconds)))
      .groupBy(sprints.id, sprints.name)

    return { byUser, bySprint }
  })
}
