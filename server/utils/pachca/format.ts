import type { DigestWorkspace } from '../notification-emails'
import type { DailyDigest } from '#shared/types/daily'

export function escapeMd(s: string): string {
  return s.replace(/([\\*_`~[\]()])/g, '\\$1')
}

export function linkRequestMarkdown(workspaceName: string): string {
  return `**Такт: подтвердите привязку**\nТак уведомления из пространства «${escapeMd(workspaceName)}» будут приходить сюда. Ссылка одноразовая.`
}

export function linkDoneMarkdown(workspaceName: string): string {
  return `Готово! Уведомления Такта из «${escapeMd(workspaceName)}» будут приходить сюда. Выбрать события можно в настройках уведомлений Такта.`
}

export function quote(s: string, max = 300): string {
  const cut = s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
  return cut.split('\n').map(line => `> ${escapeMd(line)}`).join('\n')
}

export function notificationMarkdown(d: { title: string, detail: string, snippet: string | null }): string {
  return [`**${escapeMd(d.title)}**`, d.detail ? escapeMd(d.detail) : null, d.snippet ? quote(d.snippet) : null]
    .filter((l): l is string => l !== null)
    .join('\n')
}

export function digestMarkdown(ws: DigestWorkspace): string {
  const lines = [`**Доброе утро! Вот что ждёт вас сегодня в «${escapeMd(ws.name)}»**`]
  for (const s of ws.sections) {
    lines.push('', `**${escapeMd(s.heading)}**`)
    for (const i of s.items) lines.push(`- [${escapeMd(i.title)}](${i.link})${i.detail ? ` · ${escapeMd(i.detail)}` : ''}`)
    if (s.more) lines.push(`и ещё ${s.more}`)
  }
  return lines.join('\n')
}

export type FeedItem =
  | { kind: 'task_closed' | 'task_reopened' | 'task_created', key: string, title: string, link: string }
  | { kind: 'task_blocked', key: string, title: string, link: string, reason: string | null }
  | { kind: 'sprint_started' | 'sprint_closed', name: string, link: string }

export const FEED_LINE_LIMIT = 10

const FEED_HEADINGS: Record<FeedItem['kind'], string> = {
  task_closed: 'Закрыто',
  task_reopened: 'Переоткрыто',
  task_blocked: 'Блокер',
  task_created: 'Создано',
  sprint_started: 'Спринт начат',
  sprint_closed: 'Спринт завершён',
}

const FEED_ORDER: FeedItem['kind'][] = ['task_closed', 'task_reopened', 'task_blocked', 'task_created', 'sprint_started', 'sprint_closed']

function feedLine(item: FeedItem): string {
  if ('name' in item) return `- [${escapeMd(item.name)}](${item.link})`
  const base = `- [${escapeMd(`${item.key} ${item.title}`)}](${item.link})`
  return item.kind === 'task_blocked' && item.reason ? `${base} · ${escapeMd(item.reason)}` : base
}

export function feedMarkdown(boardName: string, items: FeedItem[]): string {
  const lines = [`**${escapeMd(boardName)}**`]
  let shown = 0
  for (const kind of FEED_ORDER) {
    const group = items.filter(i => i.kind === kind)
    if (!group.length) continue
    lines.push('', `**${FEED_HEADINGS[kind]}: ${group.length}**`)
    for (const item of group) {
      if (shown === FEED_LINE_LIMIT) break
      lines.push(feedLine(item))
      shown++
    }
  }
  if (items.length > shown) lines.push('', `и ещё ${items.length - shown}`)
  return lines.join('\n')
}

export function standupMarkdown(boardName: string, d: DailyDigest, boardLink: string): string {
  const lines = [
    `**Сводка к стендапу · ${escapeMd(boardName)}**`,
    `Закрыто за сутки: ${d.stats.done.value} · В работе: ${d.stats.wip.value} · С блокером: ${d.stats.blocked.value} · Застряли: ${d.stats.aging.value}`,
  ]
  if (d.blockers.length) {
    lines.push('', '**Блокеры**')
    for (const b of d.blockers.slice(0, 5)) lines.push(`- ${escapeMd(b.title)} · ${escapeMd(b.reason ?? 'без причины')} · ${b.blockedDays} дн`)
  }
  if (d.aging.length) {
    lines.push('', '**Застряли**')
    for (const a of d.aging.slice(0, 5)) lines.push(`- ${escapeMd(a.title)} · ${a.ageDays} дн в «${escapeMd(a.columnName)}»`)
  }
  lines.push('', `[Открыть доску](${boardLink})`)
  return lines.join('\n')
}
