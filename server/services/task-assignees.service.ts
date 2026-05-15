import { and, asc, eq, sql } from 'drizzle-orm'
import {
  taskAssignees,
  taskEvents,
  tasks,
  users,
  workspaceMembers,
  type WorkspaceMemberRole,
} from '../db/schema'
import { useDB, withTenant } from '../utils/db'
import { ConflictError, NotFoundError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { requireMinRole } from '../utils/rbac'
import { emitNotification } from './notifications.service'

export interface AssigneeView {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  addedAt: Date
}

const assigneeSelect = {
  userId: taskAssignees.userId,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  avatarUrl: users.avatarUrl,
  addedAt: taskAssignees.addedAt,
} as const

export async function listAssignees(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<AssigneeView[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select(assigneeSelect)
      .from(taskAssignees)
      .innerJoin(users, eq(users.id, taskAssignees.userId))
      .where(eq(taskAssignees.taskId, input.taskId))
      .orderBy(asc(taskAssignees.addedAt)),
  )
}

export async function addAssignee(input: {
  workspaceId: string
  taskId: string
  userId: string
  actorId?: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  const [member] = await useDB()
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, input.workspaceId),
      eq(workspaceMembers.userId, input.userId),
    ))
  if (!member) throw new NotFoundError('Пользователь не состоит в этом workspace')

  const result = await withTenant(input.workspaceId, async (tx) => {
    const [task] = await tx
      .select({
        id: tasks.id,
        assigneeId: tasks.assigneeId,
        boardId: tasks.boardId,
        title: tasks.title,
      })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!task) throw new NotFoundError('Задача не найдена')

    const [existing] = await tx
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(and(
        eq(taskAssignees.taskId, input.taskId),
        eq(taskAssignees.userId, input.userId),
      ))
    if (existing) throw new ConflictError('Этот пользователь уже назначен')

    await tx.insert(taskAssignees).values({
      taskId: input.taskId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      addedBy: input.actorId ?? null,
    })

    if (!task.assigneeId) {
      await tx
        .update(tasks)
        .set({ assigneeId: input.userId, updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
    }

    await tx.insert(taskEvents).values({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      eventType: 'task_assigned',
      actorId: input.actorId ?? null,
      payload: { addedUserId: input.userId },
    })

    await emitNotification({
      tx,
      workspaceId: input.workspaceId,
      recipientId: input.userId,
      actorId: input.actorId ?? null,
      type: 'assigned',
      payload: {
        taskId: input.taskId,
        boardId: task.boardId,
        taskTitle: task.title,
        actorId: input.actorId ?? null,
      },
    })

    return { boardId: task.boardId }
  })

  publishBoardEvent({
    type: 'task.updated',
    workspaceId: input.workspaceId,
    boardId: result.boardId,
    payload: { taskId: input.taskId, assigneeAdded: input.userId },
  })
}

export async function removeAssignee(input: {
  workspaceId: string
  taskId: string
  userId: string
  actorId?: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  const result = await withTenant(input.workspaceId, async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, assigneeId: tasks.assigneeId, boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!task) throw new NotFoundError('Задача не найдена')

    const deleted = await tx
      .delete(taskAssignees)
      .where(and(
        eq(taskAssignees.taskId, input.taskId),
        eq(taskAssignees.userId, input.userId),
      ))
      .returning({ userId: taskAssignees.userId })

    if (deleted.length === 0) throw new NotFoundError('Назначение не найдено')

    if (task.assigneeId === input.userId) {
      const [next] = await tx
        .select({ userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, input.taskId))
        .orderBy(asc(taskAssignees.addedAt))
        .limit(1)
      await tx
        .update(tasks)
        .set({ assigneeId: next?.userId ?? null, updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
    }

    await tx.insert(taskEvents).values({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      eventType: 'task_assigned',
      actorId: input.actorId ?? null,
      payload: { removedUserId: input.userId },
    })

    return { boardId: task.boardId }
  })

  publishBoardEvent({
    type: 'task.updated',
    workspaceId: input.workspaceId,
    boardId: result.boardId,
    payload: { taskId: input.taskId, assigneeRemoved: input.userId },
  })
}

export async function syncFromAssigneeId(input: {
  workspaceId: string
  taskId: string
  assigneeId: string | null
  actorId?: string
}): Promise<void> {
  if (!input.assigneeId) return
  await withTenant(input.workspaceId, async (tx) => {
    await tx
      .insert(taskAssignees)
      .values({
        taskId: input.taskId,
        userId: input.assigneeId!,
        workspaceId: input.workspaceId,
        addedBy: input.actorId ?? null,
      })
      .onConflictDoNothing()
  })
}

export async function ensureAssigneeRow(input: {
  workspaceId: string
  taskId: string
  userId: string
  addedBy?: string | null
}): Promise<void> {
  await withTenant(input.workspaceId, async (tx) => {
    await tx
      .insert(taskAssignees)
      .values({
        taskId: input.taskId,
        userId: input.userId,
        workspaceId: input.workspaceId,
        addedBy: input.addedBy ?? null,
      })
      .onConflictDoNothing()
  })
}

export async function removeAssigneeRowIfPresent(input: {
  workspaceId: string
  taskId: string
  userId: string
}): Promise<void> {
  await withTenant(input.workspaceId, async (tx) => {
    await tx
      .delete(taskAssignees)
      .where(and(
        eq(taskAssignees.taskId, input.taskId),
        eq(taskAssignees.userId, input.userId),
      ))
  })
}

export async function _listAssigneeIds(input: {
  workspaceId: string
  taskId: string
}): Promise<string[]> {
  return withTenant(input.workspaceId, async (tx) => {
    const rows = await tx
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, input.taskId))
      .orderBy(asc(taskAssignees.addedAt))
    return rows.map(r => r.userId)
  })
}

void sql
