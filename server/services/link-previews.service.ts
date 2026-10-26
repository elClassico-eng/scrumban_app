import { and, eq, inArray } from 'drizzle-orm'
import { boardColumns, boards, tasks, users } from '../db/schema'
import { useDB, withTenant } from '../utils/db'
import { UnauthorizedError } from '../utils/errors'
import { appUrl } from '../utils/notification-emails'
import { pachca, PachcaError } from '../utils/pachca/client'
import { parseTaktLink, verifyPachcaSignature } from '../utils/pachca/webhook'
import { loadPachca, markPachcaFailed } from './integrations.service'
import { formatTaskKey } from '#shared/utils/board-key'
import { displayName } from '#shared/utils/display-name'

type LinkSharedEvent = {
  event?: string
  message_id?: number
  links?: { url: string, skip?: boolean }[]
}

const DUE_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })

async function taskPreview(workspaceId: string, boardId: string, taskId: string) {
  const [row] = await withTenant(workspaceId, tx =>
    tx.select({
      title: tasks.title,
      number: tasks.number,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
      boardKey: boards.key,
      columnName: boardColumns.name,
    })
      .from(tasks)
      .innerJoin(boards, eq(boards.id, tasks.boardId))
      .innerJoin(boardColumns, eq(boardColumns.id, tasks.columnId))
      .where(and(eq(tasks.id, taskId), eq(tasks.boardId, boardId))),
  )
  if (!row) return null
  const [assignee] = row.assigneeId ? await useDB().select().from(users).where(eq(users.id, row.assigneeId)) : []
  const parts = [row.columnName, assignee ? displayName(assignee) : null, row.dueDate ? `срок ${DUE_FORMAT.format(row.dueDate)}` : null]
  return {
    title: `${formatTaskKey(row.boardKey, row.number)} ${row.title}`,
    description: parts.filter(Boolean).join(' · '),
  }
}

async function boardPreview(workspaceId: string, boardId: string) {
  const [board] = await withTenant(workspaceId, tx => tx.select({ name: boards.name }).from(boards).where(eq(boards.id, boardId)))
  if (!board) return null
  const open = await withTenant(workspaceId, tx =>
    tx.select({ blocked: tasks.blockedReason })
      .from(tasks)
      .innerJoin(boardColumns, eq(boardColumns.id, tasks.columnId))
      .where(and(eq(tasks.boardId, boardId), inArray(boardColumns.columnRole, ['in_progress', 'review']))),
  )
  const blocked = open.filter(t => t.blocked !== null).length
  return { title: `Доска «${board.name}»`, description: `В работе: ${open.length} · С блокером: ${blocked}` }
}

export async function handlePachcaWebhook(input: { workspaceId: string, raw: string, signature: string | undefined }): Promise<void> {
  const ctx = await loadPachca(input.workspaceId)
  if (!ctx?.signingSecret || !verifyPachcaSignature(input.raw, input.signature, ctx.signingSecret, Math.floor(Date.now() / 1000))) {
    throw new UnauthorizedError('Неверная подпись вебхука')
  }
  const body = JSON.parse(input.raw) as LinkSharedEvent
  if (body.event !== 'link_shared' || typeof body.message_id !== 'number') return
  const previews: Record<string, { title: string, description: string }> = {}
  for (const link of body.links ?? []) {
    if (link.skip) continue
    const parsed = parseTaktLink(link.url, appUrl())
    if (!parsed || parsed.workspaceId !== input.workspaceId) continue
    const preview = parsed.taskId
      ? await taskPreview(input.workspaceId, parsed.boardId, parsed.taskId)
      : await boardPreview(input.workspaceId, parsed.boardId)
    if (preview) previews[link.url] = preview
  }
  if (!Object.keys(previews).length) return
  try {
    await pachca.linkPreviews(ctx.token, body.message_id, previews)
  }
  catch (err) {
    if (!(err instanceof PachcaError)) throw err
    if (err.kind === 'unauthorized') await markPachcaFailed(input.workspaceId, 'Пачка не принимает токен бота: его отозвали или бота удалили')
    console.warn('[pachca] link previews rejected', err.kind, err.message)
  }
}
