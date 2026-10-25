// Morning email digest: what is burning for me and what changed in tasks I
// watch, one letter across all my workspaces. Sent only to verified emails
// with the digest switched on, and only when there is something to say.
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { boards, notifications, taskAssignees, tasks, users } from '../db/schema'
import { useDB, withTenant, withUser } from '../utils/db'
import { sendEmail } from '../utils/email'
import {
  describeNotification,
  digestEmail,
  notificationLink,
  type DigestItem,
  type DigestSection,
  type DigestWorkspace,
} from '../utils/notification-emails'
import { listWorkspacesForUser } from './workspaces.service'
import { PRIMARY_TYPES } from '#shared/utils/notification-category'
import { displayName } from '#shared/utils/display-name'
import { formatTaskKey } from '#shared/utils/board-key'

const DAY_MS = 86_400_000
const ITEMS_PER_SECTION = 5
const WATCHED_TYPES = ['watched_comment', 'watched_status'] as const

type Recipient = typeof users.$inferSelect

function section(heading: string, items: DigestItem[]): DigestSection | null {
  if (!items.length) return null
  return { heading, items: items.slice(0, ITEMS_PER_SECTION), more: Math.max(0, items.length - ITEMS_PER_SECTION) }
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function taskSections(workspaceId: string, userId: string, now: Date): Promise<DigestSection[]> {
  const rows = await withTenant(workspaceId, tx =>
    tx
      .selectDistinct({
        id: tasks.id,
        title: tasks.title,
        number: tasks.number,
        dueDate: tasks.dueDate,
        blockedReason: tasks.blockedReason,
        boardId: tasks.boardId,
        boardKey: boards.key,
      })
      .from(tasks)
      .innerJoin(boards, eq(boards.id, tasks.boardId))
      .leftJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
      .where(and(
        isNull(tasks.closedAt),
        isNull(boards.archivedAt),
        or(eq(tasks.assigneeId, userId), eq(taskAssignees.userId, userId)),
        or(isNotNull(tasks.dueDate), isNotNull(tasks.blockedReason)),
      )),
  )
  const item = (t: (typeof rows)[number], detail: string): DigestItem => ({
    title: `${formatTaskKey(t.boardKey, t.number)} ${t.title}`,
    detail,
    link: notificationLink(workspaceId, { taskId: t.id, boardId: t.boardId }),
  })
  const today = utcDay(now)
  const overdue = rows.filter(t => t.dueDate && t.dueDate < now && utcDay(t.dueDate) !== today)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .map(t => item(t, `просрочено на ${(Date.parse(today) - Date.parse(utcDay(t.dueDate!))) / DAY_MS} дн`))
  const dueToday = rows.filter(t => t.dueDate && utcDay(t.dueDate) === today).map(t => item(t, 'срок сегодня'))
  const blocked = rows.filter(t => t.blockedReason).map(t => item(t, `блокер: ${t.blockedReason}`))
  return [
    section('Просрочено', overdue),
    section('Срок сегодня', dueToday),
    section('С блокером', blocked),
  ].filter((s): s is DigestSection => s !== null)
}

async function inboxSections(workspaceId: string, userId: string, since: Date, now: Date): Promise<DigestSection[]> {
  const rows = await withUser(userId, tx =>
    tx
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.workspaceId, workspaceId),
        isNull(notifications.readAt),
        isNull(notifications.clearedAt),
        or(isNull(notifications.snoozedUntil), lt(notifications.snoozedUntil, now)),
        or(
          inArray(notifications.type, PRIMARY_TYPES),
          and(inArray(notifications.type, [...WATCHED_TYPES]), gt(notifications.createdAt, since)),
        ),
      ))
      .orderBy(desc(notifications.createdAt))
      .limit(100),
  )
  const actorIds = [...new Set(rows.map(r => (r.payload as { actorId?: unknown }).actorId).filter((id): id is string => typeof id === 'string'))]
  const actors = actorIds.length ? await useDB().select().from(users).where(inArray(users.id, actorIds)) : []
  const nameOf = (id: unknown) => {
    const a = actors.find(x => x.id === id)
    return a ? displayName(a) : null
  }
  const toItem = (n: (typeof rows)[number]): DigestItem => {
    const payload = n.payload as Record<string, unknown>
    const d = describeNotification(n.type, payload, nameOf(payload.actorId))
    return { title: d.title, detail: d.detail, link: notificationLink(workspaceId, payload) }
  }
  return [
    section('Ждут вашей реакции', rows.filter(n => PRIMARY_TYPES.includes(n.type)).map(toItem)),
    section('В задачах, за которыми вы следите', rows.filter(n => (WATCHED_TYPES as readonly string[]).includes(n.type)).map(toItem)),
  ].filter((s): s is DigestSection => s !== null)
}

export async function buildDigest(recipient: Recipient, now: Date): Promise<DigestWorkspace[]> {
  const since = recipient.digestSentAt ?? new Date(now.getTime() - DAY_MS)
  const workspaces = await listWorkspacesForUser(recipient.id)
  const out: DigestWorkspace[] = []
  for (const ws of workspaces) {
    const sections = [
      ...await taskSections(ws.id, recipient.id, now),
      ...await inboxSections(ws.id, recipient.id, since, now),
    ]
    if (sections.length) out.push({ id: ws.id, name: ws.name, sections })
  }
  return out
}

export async function sendDailyDigests(now = new Date()): Promise<{ sent: number, skipped: number }> {
  const recipients = await useDB()
    .select()
    .from(users)
    .where(and(isNotNull(users.emailVerifiedAt), sql`(${users.emailPrefs}->>'digest')::boolean`))
  let sent = 0
  let skipped = 0
  for (const recipient of recipients) {
    try {
      const workspaces = await buildDigest(recipient, now)
      if (workspaces.length) {
        await sendEmail({ to: recipient.email, ...digestEmail({ recipientName: recipient.firstName ?? '', workspaces }) })
        sent++
      }
      else skipped++
      await useDB().update(users).set({ digestSentAt: now }).where(eq(users.id, recipient.id))
    }
    catch (err) {
      console.warn('[digest] failed for user', recipient.id, err)
    }
  }
  return { sent, skipped }
}
