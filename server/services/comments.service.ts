import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  taskComments,
  taskEvents,
  tasks,
  users,
  workspaceMembers,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { extractMentionedUserIds } from '../utils/mentions'
import { requireMinRole, roleAtLeast } from '../utils/rbac'

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
      .select({ boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!parent) throw new NotFoundError('Задача не найдена')

    const [inserted] = await tx
      .insert(taskComments)
      .values({
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        authorId: input.authorId,
        body: trimmed,
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