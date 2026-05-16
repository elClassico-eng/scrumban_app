import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import {
  notifications,
  type Notification,
  type NotificationType,
} from '../db/schema'
import { setUserContext, withUser, type DbTransaction } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import { publishUserEvent } from '../utils/events'

const DEFAULT_LIMIT = 50

export async function listForUser(input: {
  userId: string
  unreadOnly?: boolean
  limit?: number
}): Promise<Notification[]> {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, 200)
  return withUser(input.userId, async (tx) => {
    const base = tx.select().from(notifications)
    const filtered = input.unreadOnly
      ? base.where(and(eq(notifications.userId, input.userId), isNull(notifications.readAt)))
      : base.where(eq(notifications.userId, input.userId))
    return filtered.orderBy(desc(notifications.createdAt)).limit(limit)
  })
}

export async function unreadCountForUser(userId: string): Promise<number> {
  return withUser(userId, async (tx) => {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return row?.count ?? 0
  })
}

export async function markRead(input: {
  userId: string
  notificationId: string
}): Promise<Notification> {
  return withUser(input.userId, async (tx) => {
    const [row] = await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.id, input.notificationId),
        eq(notifications.userId, input.userId),
      ))
      .returning()
    if (!row) throw new NotFoundError('Уведомление не найдено')
    return row
  })
}

export async function markAllRead(input: {
  userId: string
  workspaceId?: string
}): Promise<number> {
  return withUser(input.userId, async (tx) => {
    const conds = [eq(notifications.userId, input.userId), isNull(notifications.readAt)]
    if (input.workspaceId) conds.push(eq(notifications.workspaceId, input.workspaceId))
    const rows = await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(...conds))
      .returning({ id: notifications.id })
    return rows.length
  })
}

export interface EmitInput {
  tx: DbTransaction
  workspaceId: string
  recipientId: string
  actorId: string | null
  type: NotificationType
  payload: Record<string, unknown>
}

export async function emitNotification(input: EmitInput): Promise<void> {
  if (input.actorId && input.actorId === input.recipientId) return

  await setUserContext(input.tx, input.recipientId)
  const [row] = await input.tx
    .insert(notifications)
    .values({
      workspaceId: input.workspaceId,
      userId: input.recipientId,
      type: input.type,
      payload: input.payload,
    })
    .returning()
  if (!row) return

  publishUserEvent({
    type: 'notification.created',
    userId: input.recipientId,
    payload: row,
  })
}