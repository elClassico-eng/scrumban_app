import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm'
import { FLOW_TYPES, PRIMARY_TYPES, type InboxView } from '#shared/utils/notification-category'
import {
  notifications,
  users,
  workspaceMembers,
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
  view?: InboxView
  types?: NotificationType[]
  unreadOnly?: boolean
  before?: Date
  limit?: number
}): Promise<NotificationWithActor[]> {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, 200)
  const conds = [eq(notifications.userId, input.userId), ...viewConds(input.view)]
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

function activeConds(now = new Date()): SQL[] {
  return [
    isNull(notifications.clearedAt),
    or(isNull(notifications.snoozedUntil), lte(notifications.snoozedUntil, now))!,
  ]
}

function viewConds(view: InboxView | undefined): SQL[] {
  switch (view) {
    case 'primary': return [...activeConds(), inArray(notifications.type, PRIMARY_TYPES)]
    case 'flow': return [...activeConds(), inArray(notifications.type, FLOW_TYPES)]
    case 'later': return [isNull(notifications.clearedAt), gt(notifications.snoozedUntil, new Date())]
    case 'cleared': return [isNotNull(notifications.clearedAt)]
    default: return activeConds()
  }
}

export type InboxCounts = { primary: number, flow: number, later: number }

export async function inboxCounts(userId: string, workspaceId: string): Promise<InboxCounts> {
  const unread = (types: NotificationType[]) =>
    sql<number>`count(*) filter (where ${and(...activeConds(), isNull(notifications.readAt), inArray(notifications.type, types))})::int`
  return withUser(userId, async (tx) => {
    const [row] = await tx
      .select({
        primary: unread(PRIMARY_TYPES),
        flow: unread(FLOW_TYPES),
        later: sql<number>`count(*) filter (where ${and(...viewConds('later'))})::int`,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId)))
    return row ?? { primary: 0, flow: 0, later: 0 }
  })
}

export async function updateMany(input: {
  userId: string
  ids: string[]
  read?: boolean
  cleared?: boolean
  snoozedUntil?: Date | null
}): Promise<number> {
  const now = new Date()
  const set: Partial<typeof notifications.$inferInsert> = {}
  if (input.read !== undefined) set.readAt = input.read ? now : null
  if (input.cleared !== undefined) {
    set.clearedAt = input.cleared ? now : null
    if (input.cleared) set.readAt = now
  }
  if (input.snoozedUntil !== undefined) {
    set.snoozedUntil = input.snoozedUntil
    if (input.snoozedUntil) Object.assign(set, { readAt: null, clearedAt: null })
  }
  return withUser(input.userId, async (tx) => {
    const rows = await tx
      .update(notifications)
      .set(set)
      .where(and(eq(notifications.userId, input.userId), inArray(notifications.id, input.ids)))
      .returning({ id: notifications.id })
    return rows.length
  })
}

export async function clearAll(input: {
  userId: string
  workspaceId: string
  view: 'primary' | 'flow'
}): Promise<number> {
  const now = new Date()
  return withUser(input.userId, async (tx) => {
    const rows = await tx
      .update(notifications)
      .set({ clearedAt: now, readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(
        eq(notifications.userId, input.userId),
        eq(notifications.workspaceId, input.workspaceId),
        ...viewConds(input.view),
      ))
      .returning({ id: notifications.id })
    return rows.length
  })
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

  // Recipients come from history (thread authors, old assignees); someone
  // removed from the workspace must not keep receiving task titles and text.
  const [membership] = await input.tx
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, input.workspaceId),
      eq(workspaceMembers.userId, input.recipientId),
    ))
  if (!membership) return

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