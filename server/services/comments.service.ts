import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import {
  taskComments,
  taskEvents,
  tasks,
  users,
  workspaceMembers,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant, type DbTransaction } from '../utils/db'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { extractMentionedUserIds } from '../utils/mentions'
import { requireMinRole, roleAtLeast } from '../utils/rbac'
import { emitNotification } from './notifications.service'
import { addWatcher, notifyWatchers } from './task-watchers.service'

const COMMENT_SNIPPET_LEN = 140

const COMMENT_MAX_LENGTH = 5000
const EDIT_WINDOW_MS = 5 * 60 * 1000

const authorSelect = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  avatarUrl: users.avatarUrl,
} as const

const commentSelect = {
  id: taskComments.id,
  workspaceId: taskComments.workspaceId,
  taskId: taskComments.taskId,
  body: taskComments.body,
  editedAt: taskComments.editedAt,
  createdAt: taskComments.createdAt,
  automationRuleId: taskComments.automationRuleId,
  parentId: taskComments.parentId,
  assigneeId: taskComments.assigneeId,
  resolvedAt: taskComments.resolvedAt,
  resolvedBy: taskComments.resolvedBy,
  author: authorSelect,
} as const

export interface CommentView {
  id: string
  workspaceId: string
  taskId: string
  body: string
  mentionedUserIds: string[]
  editedAt: Date | null
  createdAt: Date
  automationRuleId: string | null
  parentId: string | null
  assigneeId: string | null
  resolvedAt: Date | null
  resolvedBy: string | null
  author: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  } | null
}

export async function listCommentsForTask(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<CommentView[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const rows = await tx
      .select(commentSelect)
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorId))
      .where(eq(taskComments.taskId, input.taskId))
      .orderBy(asc(taskComments.createdAt))
    return rows.map(r => toView(r))
  })
}

export async function createComment(input: {
  workspaceId: string
  taskId: string
  authorId: string
  body: string
  parentId?: string
  actorRole: WorkspaceMemberRole
}): Promise<CommentView> {
  requireMinRole(input.actorRole, 'member')
  const trimmed = input.body.trim()
  if (!trimmed) throw new ValidationError('Комментарий не может быть пустым')
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new ValidationError(`Комментарий длиннее ${COMMENT_MAX_LENGTH} символов`)
  }

  const mentionedUserIds = await resolveMentionedMembers(
    input.workspaceId,
    extractMentionedUserIds(trimmed),
  )

  return withTenant(input.workspaceId, async (tx) => {
    const [parent] = await tx
      .select({ boardId: tasks.boardId, assigneeId: tasks.assigneeId, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!parent) throw new NotFoundError('Задача не найдена')

    const rootId = input.parentId ? await resolveThreadRoot(tx, input.parentId, input.taskId) : null

    const [inserted] = await tx
      .insert(taskComments)
      .values({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        authorId: input.authorId,
        body: trimmed,
        parentId: rootId,
      })
      .returning()

    await tx.insert(taskEvents).values({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      eventType: 'task_commented',
      actorId: input.authorId,
      payload: { commentId: inserted!.id, body: trimmed, mentionedUserIds },
    })

    const [row] = await tx
      .select(commentSelect)
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorId))
      .where(eq(taskComments.id, inserted!.id))

    const view = toView(row!, mentionedUserIds)
    const snippet = trimmed.length > COMMENT_SNIPPET_LEN
      ? `${trimmed.slice(0, COMMENT_SNIPPET_LEN)}…`
      : trimmed

    for (const userId of mentionedUserIds) {
      await emitNotification({
        tx,
        workspaceId: input.workspaceId,
        recipientId: userId,
        actorId: input.authorId,
        type: 'mention',
        payload: {
          taskId: input.taskId,
          boardId: parent.boardId,
          commentId: inserted!.id,
          actorId: input.authorId,
          taskTitle: parent.title,
          snippet,
        },
      })
    }

    const replyRecipients = rootId
      ? (await threadParticipants(tx, rootId)).filter(id => !mentionedUserIds.includes(id))
      : []
    for (const userId of replyRecipients) {
      await emitNotification({
        tx,
        workspaceId: input.workspaceId,
        recipientId: userId,
        actorId: input.authorId,
        type: 'reply',
        payload: {
          taskId: input.taskId,
          boardId: parent.boardId,
          commentId: inserted!.id,
          parentId: rootId,
          actorId: input.authorId,
          taskTitle: parent.title,
          snippet,
        },
      })
    }

    if (
      parent.assigneeId
      && !mentionedUserIds.includes(parent.assigneeId)
      && !replyRecipients.includes(parent.assigneeId)
    ) {
      await emitNotification({
        tx,
        workspaceId: input.workspaceId,
        recipientId: parent.assigneeId,
        actorId: input.authorId,
        type: 'comment_on_assigned',
        payload: {
          taskId: input.taskId,
          boardId: parent.boardId,
          commentId: inserted!.id,
          actorId: input.authorId,
          taskTitle: parent.title,
          snippet,
        },
      })
    }

    await addWatcher(tx, { workspaceId: input.workspaceId, taskId: input.taskId, userId: input.authorId })
    await notifyWatchers(tx, {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      actorId: input.authorId,
      type: 'watched_comment',
      payload: {
        taskId: input.taskId,
        boardId: parent.boardId,
        commentId: inserted!.id,
        actorId: input.authorId,
        taskTitle: parent.title,
        snippet,
      },
      skip: [...mentionedUserIds, ...replyRecipients, ...(parent.assigneeId ? [parent.assigneeId] : [])],
    })

    publishBoardEvent({
      type: 'task.commented',
      workspaceId: input.workspaceId,
      boardId: parent.boardId,
      payload: { taskId: input.taskId, comment: view },
    })

    return view
  })
}

export async function updateComment(input: {
  workspaceId: string
  commentId: string
  editorId: string
  body: string
  actorRole: WorkspaceMemberRole
}): Promise<CommentView> {
  requireMinRole(input.actorRole, 'member')
  const trimmed = input.body.trim()
  if (!trimmed) throw new ValidationError('Комментарий не может быть пустым')
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new ValidationError(`Комментарий длиннее ${COMMENT_MAX_LENGTH} символов`)
  }

  const mentionedUserIds = await resolveMentionedMembers(
    input.workspaceId,
    extractMentionedUserIds(trimmed),
  )

  return withTenant(input.workspaceId, async (tx) => {
    const [existing] = await tx
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        authorId: taskComments.authorId,
        createdAt: taskComments.createdAt,
      })
      .from(taskComments)
      .where(eq(taskComments.id, input.commentId))
    if (!existing) throw new NotFoundError('Комментарий не найден')

    const isAdmin = roleAtLeast(input.actorRole, 'admin')
    const isAuthor = existing.authorId === input.editorId
    const insideEditWindow =
      Date.now() - new Date(existing.createdAt).getTime() < EDIT_WINDOW_MS
    if (!isAdmin && !(isAuthor && insideEditWindow)) {
      throw new ForbiddenError('Редактировать можно только свой комментарий в течение 5 минут')
    }

    await tx
      .update(taskComments)
      .set({ body: trimmed, editedAt: new Date() })
      .where(eq(taskComments.id, input.commentId))

    const [parent] = await tx
      .select({ boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, existing.taskId))

    const [row] = await tx
      .select(commentSelect)
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorId))
      .where(eq(taskComments.id, input.commentId))

    const view = toView(row!, mentionedUserIds)

    if (parent) {
      publishBoardEvent({
        type: 'task.commented',
        workspaceId: input.workspaceId,
        boardId: parent.boardId,
        payload: { taskId: existing.taskId, comment: view, edited: true },
      })
    }

    return view
  })
}

export async function removeComment(input: {
  workspaceId: string
  commentId: string
  deleterId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  await withTenant(input.workspaceId, async (tx) => {
    const [existing] = await tx
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        authorId: taskComments.authorId,
      })
      .from(taskComments)
      .where(eq(taskComments.id, input.commentId))
    if (!existing) throw new NotFoundError('Комментарий не найден')

    const isAdmin = roleAtLeast(input.actorRole, 'admin')
    const isAuthor = existing.authorId === input.deleterId
    if (!isAdmin && !isAuthor) {
      throw new ForbiddenError('Удалять можно только свой комментарий')
    }

    await tx.delete(taskComments).where(eq(taskComments.id, input.commentId))

    await tx.insert(taskEvents).values({
      workspaceId: input.workspaceId,
      taskId: existing.taskId,
      eventType: 'task_comment_deleted',
      actorId: input.deleterId,
      payload: { commentId: input.commentId, deletedBy: input.deleterId },
    })

    const [parent] = await tx
      .select({ boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, existing.taskId))
    if (parent) {
      publishBoardEvent({
        type: 'task.comment_deleted',
        workspaceId: input.workspaceId,
        boardId: parent.boardId,
        payload: { taskId: existing.taskId, commentId: input.commentId },
      })
    }
  })
}

async function resolveThreadRoot(tx: DbTransaction, parentId: string, taskId: string): Promise<string> {
  const [target] = await tx
    .select({ id: taskComments.id, taskId: taskComments.taskId, parentId: taskComments.parentId })
    .from(taskComments)
    .where(eq(taskComments.id, parentId))
  if (!target || target.taskId !== taskId) throw new NotFoundError('Комментарий для ответа не найден')
  return target.parentId ?? target.id
}

async function threadParticipants(tx: DbTransaction, rootId: string): Promise<string[]> {
  const rows = await tx
    .select({ authorId: taskComments.authorId })
    .from(taskComments)
    .where(or(eq(taskComments.id, rootId), eq(taskComments.parentId, rootId)))
  return [...new Set(rows.map(r => r.authorId).filter((id): id is string => id !== null))]
}

async function resolveMentionedMembers(
  workspaceId: string,
  candidateIds: string[],
): Promise<string[]> {
  if (candidateIds.length === 0) return []
  const rows = await withTenant(workspaceId, async (tx) =>
    tx
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        inArray(workspaceMembers.userId, candidateIds),
      )),
  )
  return rows.map(r => r.userId)
}

type CommentRow = {
  id: string
  workspaceId: string
  taskId: string
  body: string
  editedAt: Date | null
  createdAt: Date
  automationRuleId: string | null
  parentId: string | null
  assigneeId: string | null
  resolvedAt: Date | null
  resolvedBy: string | null
  author: {
    id: string | null
    email: string | null
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  } | null
}

function toView(row: CommentRow, mentionedUserIds: string[] = []): CommentView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    taskId: row.taskId,
    body: row.body,
    mentionedUserIds: mentionedUserIds.length > 0
      ? mentionedUserIds
      : extractMentionedUserIds(row.body),
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    automationRuleId: row.automationRuleId ?? null,
    parentId: row.parentId,
    assigneeId: row.assigneeId,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
    author: row.author?.id
      ? {
          id: row.author.id,
          email: row.author.email!,
          firstName: row.author.firstName,
          lastName: row.author.lastName,
          avatarUrl: row.author.avatarUrl,
        }
      : null,
  }
}
export async function updateCommentAssignment(input: {
  workspaceId: string
  commentId: string
  actorId: string
  actorRole: WorkspaceMemberRole
  assigneeId?: string | null
  resolved?: boolean
}): Promise<CommentView> {
  requireMinRole(input.actorRole, 'member')
  const isLead = roleAtLeast(input.actorRole, 'scrum_master')

  return withTenant(input.workspaceId, async (tx) => {
    const [existing] = await tx
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        authorId: taskComments.authorId,
        assigneeId: taskComments.assigneeId,
        body: taskComments.body,
      })
      .from(taskComments)
      .where(eq(taskComments.id, input.commentId))
    if (!existing) throw new NotFoundError('Комментарий не найден')
    const isAuthor = existing.authorId === input.actorId

    const set: Partial<typeof taskComments.$inferInsert> = {}
    let assigneeId = existing.assigneeId

    if (input.assigneeId !== undefined) {
      if (!isAuthor && !isLead) throw new ForbiddenError('Поручить можно только свой комментарий')
      if (input.assigneeId) {
        const [member] = await tx
          .select({ role: workspaceMembers.role })
          .from(workspaceMembers)
          .where(and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.assigneeId),
          ))
        if (!member || !roleAtLeast(member.role, 'member')) {
          throw new ValidationError('Поручить можно только участнику, который может работать с задачами')
        }
      }
      assigneeId = input.assigneeId
      Object.assign(set, { assigneeId, resolvedAt: null, resolvedBy: null })
    }

    if (input.resolved !== undefined) {
      if (!assigneeId) throw new ValidationError('У комментария нет поручения')
      if (!isAuthor && !isLead && assigneeId !== input.actorId) {
        throw new ForbiddenError('Закрыть поручение может исполнитель, автор или скрам-мастер')
      }
      Object.assign(set, input.resolved
        ? { resolvedAt: new Date(), resolvedBy: input.actorId }
        : { resolvedAt: null, resolvedBy: null })
    }

    if (Object.keys(set).length) {
      await tx.update(taskComments).set(set).where(eq(taskComments.id, input.commentId))
    }

    const [task] = await tx
      .select({ boardId: tasks.boardId, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, existing.taskId))

    if (input.assigneeId && input.assigneeId !== existing.assigneeId && task) {
      await emitNotification({
        tx,
        workspaceId: input.workspaceId,
        recipientId: input.assigneeId,
        actorId: input.actorId,
        type: 'comment_assigned',
        payload: {
          taskId: existing.taskId,
          boardId: task.boardId,
          commentId: existing.id,
          actorId: input.actorId,
          taskTitle: task.title,
          snippet: existing.body.length > COMMENT_SNIPPET_LEN
            ? `${existing.body.slice(0, COMMENT_SNIPPET_LEN)}…`
            : existing.body,
        },
      })
    }

    const [row] = await tx
      .select(commentSelect)
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorId))
      .where(eq(taskComments.id, input.commentId))
    const view = toView(row!)

    if (task) {
      publishBoardEvent({
        type: 'task.commented',
        workspaceId: input.workspaceId,
        boardId: task.boardId,
        payload: { taskId: existing.taskId, comment: view, edited: true },
      })
    }
    return view
  })
}

export type AssignedCommentView = CommentView & { taskTitle: string, boardId: string }

export async function listOpenAssignedComments(input: {
  workspaceId: string
  userId: string
  actorRole: WorkspaceMemberRole
}): Promise<AssignedCommentView[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const rows = await tx
      .select({ ...commentSelect, taskTitle: tasks.title, boardId: tasks.boardId })
      .from(taskComments)
      .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
      .leftJoin(users, eq(users.id, taskComments.authorId))
      .where(and(eq(taskComments.assigneeId, input.userId), isNull(taskComments.resolvedAt)))
      .orderBy(desc(taskComments.createdAt))
    return rows.map(({ taskTitle, boardId, ...r }) => ({ ...toView(r), taskTitle, boardId }))
  })
}
