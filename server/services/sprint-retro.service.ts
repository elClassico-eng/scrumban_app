import { and, asc, eq, isNull } from 'drizzle-orm'
import {
  boardColumns,
  sprintRetroNotes,
  sprints,
  tasks,
  type RetroCategory,
  type SprintRetroNote,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { requireMinRole, roleAtLeast } from '../utils/rbac'
import { createTask } from './tasks.service'
import { addTaskToSprint } from './sprints.service'

export async function listRetroNotes(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintRetroNote[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, tx =>
    tx
      .select()
      .from(sprintRetroNotes)
      .where(eq(sprintRetroNotes.sprintId, input.sprintId))
      .orderBy(asc(sprintRetroNotes.createdAt)))
}

export async function createRetroNote(input: {
  workspaceId: string
  sprintId: string
  category: RetroCategory
  body: string
  taskId?: string | null
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintRetroNote> {
  requireMinRole(input.actorRole, 'member')

  return withTenant(input.workspaceId, async (tx) => {
    const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
    if (!sprint) throw new NotFoundError('Спринт не найден')
    if (sprint.state === 'planned') {
      throw new ValidationError('Заметки ретро появляются после старта спринта')
    }

    if (input.taskId) {
      const [task] = await tx
        .select({ boardId: tasks.boardId })
        .from(tasks)
        .where(eq(tasks.id, input.taskId))
      if (!task) throw new NotFoundError('Задача не найдена')
      if (task.boardId !== sprint.boardId) {
        throw new ValidationError('Задача и спринт относятся к разным доскам')
      }
    }

    const [row] = await tx
      .insert(sprintRetroNotes)
      .values({
        workspaceId: input.workspaceId,
        sprintId: input.sprintId,
        category: input.category,
        body: input.body.trim(),
        taskId: input.taskId ?? null,
        authorId: input.actorId,
      })
      .returning()
    return row!
  })
}

export async function updateRetroNote(input: {
  workspaceId: string
  sprintId: string
  noteId: string
  patch: { body?: string; category?: RetroCategory; isResolved?: boolean }
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintRetroNote> {
  requireMinRole(input.actorRole, 'member')

  return withTenant(input.workspaceId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(sprintRetroNotes)
      .where(and(
        eq(sprintRetroNotes.id, input.noteId),
        eq(sprintRetroNotes.sprintId, input.sprintId),
      ))
    if (!existing) throw new NotFoundError('Заметка не найдена')

    const contentChange = input.patch.body !== undefined || input.patch.category !== undefined
    if (contentChange && existing.authorId !== input.actorId && !roleAtLeast(input.actorRole, 'admin')) {
      throw new ForbiddenError('Изменять можно только свою заметку')
    }

    const set: Partial<typeof sprintRetroNotes.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    }
    if (input.patch.body !== undefined) set.body = input.patch.body.trim()
    if (input.patch.category !== undefined) set.category = input.patch.category
    if (input.patch.isResolved !== undefined) set.isResolved = input.patch.isResolved

    const [row] = await tx
      .update(sprintRetroNotes)
      .set(set)
      .where(eq(sprintRetroNotes.id, input.noteId))
      .returning()
    return row!
  })
}

export async function removeRetroNote(input: {
  workspaceId: string
  sprintId: string
  noteId: string
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  await withTenant(input.workspaceId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(sprintRetroNotes)
      .where(and(
        eq(sprintRetroNotes.id, input.noteId),
        eq(sprintRetroNotes.sprintId, input.sprintId),
      ))
    if (!existing) throw new NotFoundError('Заметка не найдена')
    if (existing.authorId !== input.actorId && !roleAtLeast(input.actorRole, 'admin')) {
      throw new ForbiddenError('Удалять можно только свою заметку')
    }
    await tx.delete(sprintRetroNotes).where(eq(sprintRetroNotes.id, input.noteId))
  })
}

export async function convertActionItem(input: {
  workspaceId: string
  sprintId: string
  noteId: string
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<{ note: SprintRetroNote; taskId: string; addedToSprintId: string | null }> {
  requireMinRole(input.actorRole, 'member')

  const prepared = await withTenant(input.workspaceId, async (tx) => {
    const [note] = await tx
      .select()
      .from(sprintRetroNotes)
      .where(and(
        eq(sprintRetroNotes.id, input.noteId),
        eq(sprintRetroNotes.sprintId, input.sprintId),
      ))
      .for('update')
    if (!note) throw new NotFoundError('Заметка не найдена')
    if (note.category !== 'action_item') {
      throw new ValidationError('В задачу конвертируются только пункты «Действия»')
    }
    if (note.convertedTaskId) {
      throw new ConflictError('Эта заметка уже превращена в задачу')
    }

    const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
    if (!sprint) throw new NotFoundError('Спринт не найден')

    const [firstColumn] = await tx
      .select({ id: boardColumns.id })
      .from(boardColumns)
      .where(eq(boardColumns.boardId, sprint.boardId))
      .orderBy(asc(boardColumns.position))
      .limit(1)
    if (!firstColumn) throw new ValidationError('На доске нет колонок')

    const planned = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, sprint.boardId), eq(sprints.state, 'planned')))
      .orderBy(asc(sprints.plannedStartAt), asc(sprints.createdAt))

    return {
      boardId: sprint.boardId,
      columnId: firstColumn.id,
      nextSprintId: planned[0]?.id ?? null,
      body: note.body,
    }
  })

  const task = await createTask({
    workspaceId: input.workspaceId,
    boardId: prepared.boardId,
    columnId: prepared.columnId,
    title: prepared.body.slice(0, 255),
    description: `Решение ретроспективы спринта.`,
    actorId: input.actorId,
    actorRole: input.actorRole,
  })

  if (prepared.nextSprintId) {
    await addTaskToSprint({
      workspaceId: input.workspaceId,
      sprintId: prepared.nextSprintId,
      taskId: task.id,
      actorId: input.actorId,
      actorRole: input.actorRole,
    })
  }

  const note = await withTenant(input.workspaceId, async (tx) => {
    const [row] = await tx
      .update(sprintRetroNotes)
      .set({ convertedTaskId: task.id, updatedAt: new Date() })
      .where(and(
        eq(sprintRetroNotes.id, input.noteId),
        isNull(sprintRetroNotes.convertedTaskId),
      ))
      .returning()
    if (!row) throw new ConflictError('Эта заметка уже превращена в задачу')
    return row
  })

  return { note, taskId: task.id, addedToSprintId: prepared.nextSprintId }
}
