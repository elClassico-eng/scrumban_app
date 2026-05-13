import { and, asc, eq, sql } from 'drizzle-orm'
import {
  taskChecklistItems,
  tasks,
  type TaskChecklistItem,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { requireMinRole } from '../utils/rbac'

export async function listChecklist(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<TaskChecklistItem[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, input.taskId))
      .orderBy(asc(taskChecklistItems.position)),
  )
}

export async function createChecklistItem(input: {
  workspaceId: string
  taskId: string
  title: string
  actorRole: WorkspaceMemberRole
}): Promise<TaskChecklistItem> {
  requireMinRole(input.actorRole, 'member')
  const title = input.title.trim()
  if (!title) throw new ValidationError('Название не может быть пустым')

  return withTenant(input.workspaceId, async (tx) => {
    const [parent] = await tx
      .select({ boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!parent) throw new NotFoundError('Задача не найдена')

    const [agg] = await tx
      .select({ next: sql<number>`COALESCE(MAX(${taskChecklistItems.position}), -1) + 1` })
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, input.taskId))

    const [row] = await tx
      .insert(taskChecklistItems)
      .values({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        title,
        position: Number(agg!.next),
      })
      .returning()

    publishBoardEvent({
      type: 'task.updated',
      workspaceId: input.workspaceId,
      boardId: parent.boardId,
      payload: { taskId: input.taskId, checklistItemAdded: row },
    })
    return row!
  })
}

export async function updateChecklistItem(input: {
  workspaceId: string
  itemId: string
  patch: { title?: string; isDone?: boolean }
  actorRole: WorkspaceMemberRole
}): Promise<TaskChecklistItem> {
  requireMinRole(input.actorRole, 'member')

  const set: Partial<typeof taskChecklistItems.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if (input.patch.title !== undefined) {
    const trimmed = input.patch.title.trim()
    if (!trimmed) throw new ValidationError('Название не может быть пустым')
    set.title = trimmed
  }
  if (input.patch.isDone !== undefined) set.isDone = input.patch.isDone

  return withTenant(input.workspaceId, async (tx) => {
    const [row] = await tx
      .update(taskChecklistItems)
      .set(set)
      .where(eq(taskChecklistItems.id, input.itemId))
      .returning()
    if (!row) throw new NotFoundError('Пункт чек-листа не найден')

    const [parent] = await tx
      .select({ boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, row.taskId))
    if (parent) {
      publishBoardEvent({
        type: 'task.updated',
        workspaceId: input.workspaceId,
        boardId: parent.boardId,
        payload: { taskId: row.taskId, checklistItemUpdated: row },
      })
    }
    return row
  })
}

export async function deleteChecklistItem(input: {
  workspaceId: string
  itemId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  await withTenant(input.workspaceId, async (tx) => {
    const [row] = await tx
      .select({ taskId: taskChecklistItems.taskId })
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.id, input.itemId))
    if (!row) throw new NotFoundError('Пункт чек-листа не найден')

    await tx.delete(taskChecklistItems).where(eq(taskChecklistItems.id, input.itemId))

    const [parent] = await tx
      .select({ boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, row.taskId))
    if (parent) {
      publishBoardEvent({
        type: 'task.updated',
        workspaceId: input.workspaceId,
        boardId: parent.boardId,
        payload: { taskId: row.taskId, checklistItemDeleted: input.itemId },
      })
    }
  })
}

// Atomic reorder of all checklist items for a task. Two-phase position
// renumber (park into a high range, then settle) mirrors the columns/
// tasks reorder pattern so we never trip a unique-index mid-transaction
// (no such index here, but the pattern keeps positions clean for ordering).
export async function reorderChecklist(input: {
  workspaceId: string
  taskId: string
  orderedIds: string[]
  actorRole: WorkspaceMemberRole
}): Promise<TaskChecklistItem[]> {
  requireMinRole(input.actorRole, 'member')

  if (new Set(input.orderedIds).size !== input.orderedIds.length) {
    throw new ValidationError('Список не должен содержать дубликаты')
  }

  return withTenant(input.workspaceId, async (tx) => {
    const existing = await tx
      .select({ id: taskChecklistItems.id })
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, input.taskId))
    const existingIds = new Set(existing.map(r => r.id))
    if (input.orderedIds.length !== existing.length) {
      throw new ValidationError('Список должен содержать все пункты чек-листа')
    }
    for (const id of input.orderedIds) {
      if (!existingIds.has(id)) {
        throw new ValidationError(`Неизвестный id пункта: ${id}`)
      }
    }

    for (let i = 0; i < input.orderedIds.length; i++) {
      await tx
        .update(taskChecklistItems)
        .set({ position: i, updatedAt: new Date() })
        .where(and(
          eq(taskChecklistItems.id, input.orderedIds[i]!),
          eq(taskChecklistItems.taskId, input.taskId),
        ))
    }

    return tx
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, input.taskId))
      .orderBy(asc(taskChecklistItems.position))
  })
}