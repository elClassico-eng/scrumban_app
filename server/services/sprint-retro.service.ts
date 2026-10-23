import { and, asc, eq, isNull } from 'drizzle-orm'
import {
  boardColumns,
  sprintRetroNotes,
  sprintRetroVotes,
  sprints,
  tasks,
  workspaceMembers,
  type RetroCategory,
  type RetroPhase,
  type SprintRetroNote,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant, type DbTransaction } from '../utils/db'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { requireMinRole, roleAtLeast } from '../utils/rbac'
import { createTask } from './tasks.service'
import { addTaskToSprint } from './sprints.service'

export const RETRO_VOTES_PER_PERSON = 3

export type RetroNoteView = SprintRetroNote & {
  voteCount: number
  votedByMe: boolean
  hidden: boolean
}

export type RetroBoard = { phase: RetroPhase, notes: RetroNoteView[], myVotesLeft: number }

const OPINION: RetroCategory[] = ['went_well', 'to_improve']

async function sprintOrThrow(tx: DbTransaction, sprintId: string, lock = false) {
  const query = tx.select().from(sprints).where(eq(sprints.id, sprintId))
  const [sprint] = lock ? await query.for('update') : await query
  if (!sprint) throw new NotFoundError('Спринт не найден')
  return sprint
}

function retroChanged(workspaceId: string, boardId: string, sprintId: string) {
  publishBoardEvent({ type: 'retro.changed', workspaceId, boardId, payload: { sprintId } })
}

// While the team is collecting, opinions stay private so nobody anchors on
// the first loud note; actions are decisions and are always visible.
export async function listRetroNotes(input: {
  workspaceId: string
  sprintId: string
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<RetroBoard> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const sprint = await sprintOrThrow(tx, input.sprintId)
    const notes = await tx
      .select()
      .from(sprintRetroNotes)
      .where(eq(sprintRetroNotes.sprintId, input.sprintId))
      .orderBy(asc(sprintRetroNotes.createdAt))
    const votes = await tx
      .select({ noteId: sprintRetroVotes.noteId, userId: sprintRetroVotes.userId })
      .from(sprintRetroVotes)
      .innerJoin(sprintRetroNotes, eq(sprintRetroNotes.id, sprintRetroVotes.noteId))
      .where(eq(sprintRetroNotes.sprintId, input.sprintId))

    const views = notes.map((n) => {
      const hidden = sprint.retroPhase === 'collect' && OPINION.includes(n.category) && n.authorId !== input.actorId
      const noteVotes = votes.filter(v => v.noteId === n.id)
      return {
        ...n,
        body: hidden ? '' : n.body,
        taskId: hidden ? null : n.taskId,
        voteCount: noteVotes.length,
        votedByMe: noteVotes.some(v => v.userId === input.actorId),
        hidden,
      }
    })
    const used = votes.filter(v => v.userId === input.actorId).length
    return { phase: sprint.retroPhase, notes: views, myVotesLeft: Math.max(0, RETRO_VOTES_PER_PERSON - used) }
  })
}

export async function setRetroPhase(input: {
  workspaceId: string
  sprintId: string
  phase: RetroPhase
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'scrum_master')
  const boardId = await withTenant(input.workspaceId, async (tx) => {
    const sprint = await sprintOrThrow(tx, input.sprintId)
    await tx.update(sprints).set({ retroPhase: input.phase, updatedAt: new Date() }).where(eq(sprints.id, input.sprintId))
    return sprint.boardId
  })
  retroChanged(input.workspaceId, boardId, input.sprintId)
}

export async function setRetroVote(input: {
  workspaceId: string
  sprintId: string
  noteId: string
  on: boolean
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')
  const boardId = await withTenant(input.workspaceId, async (tx) => {
    // The sprint row lock serialises one person's parallel clicks so the
    // per-person limit cannot be overshot.
    const sprint = await sprintOrThrow(tx, input.sprintId, true)
    const [note] = await tx
      .select()
      .from(sprintRetroNotes)
      .where(and(eq(sprintRetroNotes.id, input.noteId), eq(sprintRetroNotes.sprintId, input.sprintId)))
    if (!note) throw new NotFoundError('Заметка не найдена')

    if (!input.on) {
      await tx
        .delete(sprintRetroVotes)
        .where(and(eq(sprintRetroVotes.noteId, input.noteId), eq(sprintRetroVotes.userId, input.actorId)))
      return sprint.boardId
    }

    if (sprint.retroPhase !== 'discuss') throw new ValidationError('Голосование начнётся, когда откроют заметки')
    if (!OPINION.includes(note.category)) throw new ValidationError('Голосуют за заметки «Хорошо» и «Улучшить»')
    const mine = await tx
      .select({ noteId: sprintRetroVotes.noteId })
      .from(sprintRetroVotes)
      .innerJoin(sprintRetroNotes, eq(sprintRetroNotes.id, sprintRetroVotes.noteId))
      .where(and(eq(sprintRetroNotes.sprintId, input.sprintId), eq(sprintRetroVotes.userId, input.actorId)))
    if (mine.some(v => v.noteId === input.noteId)) return sprint.boardId
    if (mine.length >= RETRO_VOTES_PER_PERSON) {
      throw new ConflictError('Голоса закончились: снимите голос с другой заметки')
    }
    await tx.insert(sprintRetroVotes).values({ noteId: input.noteId, userId: input.actorId, workspaceId: input.workspaceId })
    return sprint.boardId
  })
  retroChanged(input.workspaceId, boardId, input.sprintId)
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
    return { row: row!, boardId: sprint.boardId }
  }).then(({ row, boardId }) => {
    retroChanged(input.workspaceId, boardId, input.sprintId)
    return row
  })
}

export async function updateRetroNote(input: {
  workspaceId: string
  sprintId: string
  noteId: string
  patch: { body?: string; category?: RetroCategory; isResolved?: boolean; assigneeId?: string | null; dueDate?: Date | null }
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

    const actionOnly = input.patch.isResolved !== undefined || 'assigneeId' in input.patch || 'dueDate' in input.patch
    if (actionOnly && existing.category !== 'action_item') {
      throw new ValidationError('Отметка, ответственный и срок бывают только у действий')
    }
    if (input.patch.assigneeId) {
      const [member] = await tx
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, input.workspaceId), eq(workspaceMembers.userId, input.patch.assigneeId)))
      if (!member) throw new ValidationError('Ответственный должен быть участником воркспейса')
    }
    if ('assigneeId' in input.patch) set.assigneeId = input.patch.assigneeId ?? null
    if ('dueDate' in input.patch) set.dueDate = input.patch.dueDate ?? null

    const [row] = await tx
      .update(sprintRetroNotes)
      .set(set)
      .where(eq(sprintRetroNotes.id, input.noteId))
      .returning()
    const sprint = await sprintOrThrow(tx, input.sprintId)
    const hidden = sprint.retroPhase === 'collect' && OPINION.includes(row!.category) && row!.authorId !== input.actorId
    return { row: hidden ? { ...row!, body: '', taskId: null } : row!, boardId: sprint.boardId }
  }).then(({ row, boardId }) => {
    retroChanged(input.workspaceId, boardId, input.sprintId)
    return row
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
    return (await sprintOrThrow(tx, input.sprintId)).boardId
  }).then(boardId => retroChanged(input.workspaceId, boardId, input.sprintId))
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
      assigneeId: note.assigneeId,
      dueDate: note.dueDate,
    }
  })

  const task = await createTask({
    workspaceId: input.workspaceId,
    boardId: prepared.boardId,
    columnId: prepared.columnId,
    title: prepared.body.slice(0, 255),
    description: `Решение ретроспективы спринта.`,
    assigneeId: prepared.assigneeId,
    dueDate: prepared.dueDate,
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

  retroChanged(input.workspaceId, prepared.boardId, input.sprintId)
  return { note, taskId: task.id, addedToSprintId: prepared.nextSprintId }
}
