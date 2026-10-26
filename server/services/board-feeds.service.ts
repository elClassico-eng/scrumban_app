import { and, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm'
import { boardFeeds, boards, sprintEvents, sprints, taskEvents, tasks, workspaces, type BoardFeed, type WorkspaceMemberRole } from '../db/schema'
import { useDB, withTenant } from '../utils/db'
import { NotFoundError, ValidationError } from '../utils/errors'
import { appUrl, notificationLink } from '../utils/notification-emails'
import { pachca } from '../utils/pachca/client'
import { feedMarkdown, standupMarkdown, type FeedItem } from '../utils/pachca/format'
import { requireMinRole } from '../utils/rbac'
import { computeDailyDigest } from './daily-digest.service'
import { withPachca } from './integrations.service'
import { formatTaskKey } from '#shared/utils/board-key'
import type { BoardFeedView, FeedEvent, PachcaChat } from '#shared/types/integrations'

const FAILING_LIMIT_MS = 3_600_000
const MSK_OFFSET_MS = 3 * 3_600_000
const DEFAULT_SETTLE_MS = 5_000
const MAX_CHAT_PAGES = 20
const TASK_FEED_EVENTS = ['task_closed', 'task_reopened', 'task_blocked', 'task_created'] as const
const SPRINT_FEED_EVENTS = ['sprint_started', 'sprint_closed'] as const

type TaskFeedKind = (typeof TASK_FEED_EVENTS)[number]
type SprintFeedKind = (typeof SPRINT_FEED_EVENTS)[number]

function settleMs(): number {
  const raw = process.env.FEED_SETTLE_MS
  return raw === undefined ? DEFAULT_SETTLE_MS : Number(raw)
}

function toView(f: BoardFeed): BoardFeedView {
  return { id: f.id, chatId: f.chatId, chatName: f.chatName, events: f.events, standupTime: f.standupTime, status: f.status }
}

function requireConnected<T>(value: T | null): T {
  if (value === null) throw new ValidationError('Пачка не подключена к этому пространству или работает с ошибкой')
  return value
}

function boardLink(workspaceId: string, boardId: string): string {
  return `${appUrl()}/workspaces/${workspaceId}/boards/${boardId}`
}

function mskNow(now: Date) {
  const shifted = new Date(now.getTime() + MSK_OFFSET_MS)
  const iso = shifted.toISOString()
  return { day: iso.slice(0, 10), time: iso.slice(11, 16), weekday: shifted.getUTCDay() }
}

export async function listBotChats(input: { workspaceId: string, actorRole: WorkspaceMemberRole }): Promise<PachcaChat[]> {
  requireMinRole(input.actorRole, 'admin')
  const chats = await withPachca(input.workspaceId, async (ctx) => {
    const out: PachcaChat[] = []
    let cursor: string | undefined
    for (let page = 0; page < MAX_CHAT_PAGES; page++) {
      const res = await pachca.chats(ctx.token, cursor)
      out.push(...res.chats.map(c => ({ id: String(c.id), name: c.name })))
      if (!res.next) break
      cursor = res.next
    }
    return out
  })
  return requireConnected(chats)
}

export async function listFeeds(input: { workspaceId: string, boardId: string, actorRole: WorkspaceMemberRole }): Promise<BoardFeedView[]> {
  requireMinRole(input.actorRole, 'admin')
  const rows = await withTenant(input.workspaceId, tx =>
    tx.select().from(boardFeeds).where(and(eq(boardFeeds.workspaceId, input.workspaceId), eq(boardFeeds.boardId, input.boardId))),
  )
  return rows.map(toView)
}

export async function createFeed(input: {
  workspaceId: string
  boardId: string
  actorId: string
  actorRole: WorkspaceMemberRole
  chatId: string
  events: FeedEvent[]
  standupTime: string | null
}): Promise<BoardFeedView> {
  const chats = await listBotChats(input)
  const chat = chats.find(c => c.id === input.chatId)
  if (!chat) throw new ValidationError('Бот не состоит в этом чате. Добавьте бота в чат в Пачке')
  const [board] = await withTenant(input.workspaceId, tx => tx.select({ id: boards.id }).from(boards).where(eq(boards.id, input.boardId)))
  if (!board) throw new NotFoundError('Доска не найдена')
  const [row] = await withTenant(input.workspaceId, tx =>
    tx.insert(boardFeeds).values({
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      provider: 'pachca',
      chatId: chat.id,
      chatName: chat.name,
      events: input.events,
      standupTime: input.standupTime,
      createdBy: input.actorId,
    }).onConflictDoNothing().returning(),
  )
  if (!row) throw new ValidationError('Лента в этот чат уже настроена')
  return toView(row)
}

async function findFeed(workspaceId: string, boardId: string, feedId: string): Promise<BoardFeed> {
  const [row] = await withTenant(workspaceId, tx =>
    tx.select().from(boardFeeds).where(and(eq(boardFeeds.id, feedId), eq(boardFeeds.boardId, boardId))),
  )
  if (!row) throw new NotFoundError('Лента не найдена')
  return row
}

export async function updateFeed(input: {
  workspaceId: string
  boardId: string
  feedId: string
  actorRole: WorkspaceMemberRole
  events?: FeedEvent[]
  standupTime?: string | null
}): Promise<BoardFeedView> {
  requireMinRole(input.actorRole, 'admin')
  await findFeed(input.workspaceId, input.boardId, input.feedId)
  const [row] = await withTenant(input.workspaceId, tx =>
    tx.update(boardFeeds).set({
      ...(input.events ? { events: input.events } : {}),
      ...(input.standupTime !== undefined ? { standupTime: input.standupTime, standupSentOn: null } : {}),
      status: 'active',
      failingSince: null,
    }).where(eq(boardFeeds.id, input.feedId)).returning(),
  )
  return toView(row!)
}

export async function deleteFeed(input: { workspaceId: string, boardId: string, feedId: string, actorRole: WorkspaceMemberRole }): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  await findFeed(input.workspaceId, input.boardId, input.feedId)
  await withTenant(input.workspaceId, tx => tx.delete(boardFeeds).where(eq(boardFeeds.id, input.feedId)))
}

export async function sendTestMessage(input: { workspaceId: string, boardId: string, feedId: string, actorRole: WorkspaceMemberRole }): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  const feed = await findFeed(input.workspaceId, input.boardId, input.feedId)
  const done = await withPachca(input.workspaceId, ctx =>
    pachca.sendMessage(ctx.token, { entityType: 'discussion', entityId: Number(feed.chatId), content: 'Такт подключён: сюда будут приходить события доски.' }),
  )
  requireConnected(done)
}

async function collectItems(feed: BoardFeed, until: Date): Promise<FeedItem[]> {
  const taskKinds = TASK_FEED_EVENTS.filter(k => feed.events.includes(k))
  const sprintKinds = SPRINT_FEED_EVENTS.filter(k => feed.events.includes(k))
  const items: FeedItem[] = []
  if (taskKinds.length) {
    const rows = await withTenant(feed.workspaceId, tx =>
      tx.select({
        kind: taskEvents.eventType,
        payload: taskEvents.payload,
        taskId: tasks.id,
        title: tasks.title,
        number: tasks.number,
        boardKey: boards.key,
      })
        .from(taskEvents)
        .innerJoin(tasks, eq(tasks.id, taskEvents.taskId))
        .innerJoin(boards, eq(boards.id, tasks.boardId))
        .where(and(
          eq(tasks.boardId, feed.boardId),
          inArray(taskEvents.eventType, taskKinds),
          gt(taskEvents.createdAt, feed.cursor),
          lte(taskEvents.createdAt, until),
          sql`${taskEvents.payload}->'import' IS NULL`,
        ))
        .orderBy(taskEvents.createdAt),
    )
    for (const r of rows) {
      const base = {
        key: formatTaskKey(r.boardKey, r.number),
        title: r.title,
        link: notificationLink(feed.workspaceId, { taskId: r.taskId, boardId: feed.boardId }),
      }
      if (r.kind === 'task_blocked') items.push({ kind: 'task_blocked', ...base, reason: (r.payload as { reason?: string }).reason ?? null })
      else items.push({ kind: r.kind as Exclude<TaskFeedKind, 'task_blocked'>, ...base })
    }
  }
  if (sprintKinds.length) {
    const rows = await withTenant(feed.workspaceId, tx =>
      tx.select({ kind: sprintEvents.eventType, name: sprints.name })
        .from(sprintEvents)
        .innerJoin(sprints, eq(sprints.id, sprintEvents.sprintId))
        .where(and(
          eq(sprints.boardId, feed.boardId),
          inArray(sprintEvents.eventType, sprintKinds),
          gt(sprintEvents.createdAt, feed.cursor),
          lte(sprintEvents.createdAt, until),
        ))
        .orderBy(sprintEvents.createdAt),
    )
    for (const r of rows) {
      items.push({ kind: r.kind as SprintFeedKind, name: r.name, link: `${boardLink(feed.workspaceId, feed.boardId)}/sprints` })
    }
  }
  return items
}

async function runFeed(feed: BoardFeed, boardName: string, now: Date): Promise<boolean> {
  const until = new Date(now.getTime() - settleMs())
  const fresh = until > feed.cursor
  const items = fresh ? await collectItems(feed, until) : []
  const cursor = fresh ? until : feed.cursor
  const msk = mskNow(now)
  const standupDue = !!feed.standupTime
    && msk.weekday !== 0
    && msk.weekday !== 6
    && msk.time >= feed.standupTime
    && feed.standupSentOn !== msk.day
  if (!items.length && !standupDue) {
    await withTenant(feed.workspaceId, tx => tx.update(boardFeeds).set({ cursor }).where(eq(boardFeeds.id, feed.id)))
    return false
  }
  try {
    const sent = await withPachca(feed.workspaceId, async (ctx) => {
      if (items.length) {
        await pachca.sendMessage(ctx.token, { entityType: 'discussion', entityId: Number(feed.chatId), content: feedMarkdown(boardName, items) })
      }
      if (standupDue) {
        const digest = await computeDailyDigest({ workspaceId: feed.workspaceId, boardId: feed.boardId, actorRole: 'admin' })
        await pachca.sendMessage(ctx.token, {
          entityType: 'discussion',
          entityId: Number(feed.chatId),
          content: standupMarkdown(boardName, digest, boardLink(feed.workspaceId, feed.boardId)),
        })
      }
      return true
    })
    if (!sent) return false
    await withTenant(feed.workspaceId, tx => tx.update(boardFeeds).set({
      cursor,
      failingSince: null,
      ...(standupDue ? { standupSentOn: msk.day } : {}),
    }).where(eq(boardFeeds.id, feed.id)))
    return true
  }
  catch (err) {
    const failingSince = feed.failingSince ?? now
    const tooLong = now.getTime() - failingSince.getTime() > FAILING_LIMIT_MS
    await withTenant(feed.workspaceId, tx => tx.update(boardFeeds).set({
      failingSince,
      ...(tooLong ? { status: 'error' as const } : {}),
    }).where(eq(boardFeeds.id, feed.id)))
    throw err
  }
}

export async function runFeeds(now = new Date()): Promise<{ sent: number, failed: number }> {
  let sent = 0
  let failed = 0
  const wsList = await useDB().select({ id: workspaces.id }).from(workspaces)
  for (const ws of wsList) {
    const feeds = await withTenant(ws.id, tx =>
      tx.select({ feed: boardFeeds, boardName: boards.name })
        .from(boardFeeds)
        .innerJoin(boards, eq(boards.id, boardFeeds.boardId))
        .where(and(eq(boardFeeds.workspaceId, ws.id), eq(boardFeeds.status, 'active'), isNull(boards.archivedAt))),
    )
    for (const { feed, boardName } of feeds) {
      try {
        if (await runFeed(feed, boardName, now)) sent++
      }
      catch (err) {
        failed++
        console.warn('[feeds] failed', feed.id, err)
      }
    }
  }
  return { sent, failed }
}
