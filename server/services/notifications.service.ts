import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import {
  notifications,
  users,
  type Notification,
  type NotificationType,
} from '../db/schema'
import { setUserContext, withUser, type DbTransaction } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import { publishUserEvent } from '../utils/events'

const DEFAULT_LIMIT = 50

export async function listForUser(input: {
  userId: string
  workspaceId?: string
  types?: NotificationType[]
  unreadOnly?: boolean
  before?: Date
  limit?: number
}): Promise<NotificationWithActor[]> {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, 200)
  const conds = [eq(notifications.userId, input.userId)]
  if (input.workspaceId) conds.push(eq(notifications.workspaceId, input.workspaceId))
  if (input.types?.length) conds.push(inArray(notifications.type, input.types))
  if (input.unreadOnly) conds.push(isNull(notifications.readAt))
  if (input.before) conds.push(lt(notifications.createdAt, input.before))
  const rows = await withUser(input.userId, async (tx) =>
    tx
      .select({
        notification: notifications,
        actor: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(notifications)
      .leftJoin(users, sql`${users.id} = (${notifications.payload}->>'actorId')::uuid`)
      .where(and(...conds))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
  )
  return rows.map(r => ({ ...r.notification, actor: r.actor?.id ? r.actor : null }))
}

export type NotificationActor = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

export type NotificationWithActor = Notification & { actor: NotificationActor | null }

export async function unreadCountForUser(userId: string, workspaceId?: string): Promise<number> {
  const conds = [eq(notifications.userId, userId), isNull(notifications.readAt)]
  if (workspaceId) conds.push(eq(notifications.workspaceId, workspaceId))
  return withUser(userId, async (tx) => {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conds))
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

  const [recipient] = await input.tx
    .select({ prefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, input.recipientId))
  if (recipient?.prefs[input.type] === false) return

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