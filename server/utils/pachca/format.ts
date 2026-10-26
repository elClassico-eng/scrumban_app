import type { DigestWorkspace } from '../notification-emails'

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
