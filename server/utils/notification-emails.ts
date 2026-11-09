import type { NotificationType } from '../db/schema'
import { baseTemplate, ctaButton, escapeHtml } from './email-templates'

type Payload = Record<string, unknown>

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

export function notificationLink(workspaceId: string, payload: Payload): string {
  const base = `${appUrl()}/workspaces/${workspaceId}`
  if (typeof payload.taskId === 'string' && typeof payload.boardId === 'string') {
    return `${base}/boards/${payload.boardId}?task=${payload.taskId}`
  }
  return `${base}/inbox`
}

const TITLE: Record<NotificationType, string> = {
  mention: 'Вас упомянули в комментарии',
  reply: 'Ответили в ветке',
  comment_assigned: 'Вам поручение',
  assigned: 'Вам назначили задачу',
  comment_on_assigned: 'Комментарий к вашей задаче',
  watched_comment: 'Новый комментарий',
  watched_status: 'Задача сменила статус',
  sle_breach: 'Задача застряла дольше SLE',
  replenishment_overdue: 'Пора пополнить бэклог',
  sprint_forecast_drop: 'Прогноз спринта упал',
  automation: 'Сработала автоматизация',
  integration_failed: 'Интеграция перестала работать',
}

export function describeNotification(type: NotificationType, payload: Payload, actorName: string | null) {
  const task = typeof payload.taskTitle === 'string' ? `«${payload.taskTitle}»` : null
  const title = type === 'watched_status' && typeof payload.columnName === 'string'
    ? `Перешла в «${payload.columnName}»`
    : TITLE[type]
  const detail = [actorName, task].filter(Boolean).join(' · ')
  const snippet = typeof payload.snippet === 'string' ? payload.snippet : null
  return { title, detail, snippet }
}

export function notificationEmail(opts: {
  type: NotificationType
  payload: Payload
  actorName: string | null
  link: string
}) {
  const { title, detail, snippet } = describeNotification(opts.type, opts.payload, opts.actorName)
  const subject = `${title}${typeof opts.payload.taskTitle === 'string' ? `: ${opts.payload.taskTitle}` : ''} – Такт`
  const text = [title, detail, snippet, '', opts.link, '', `Настроить письма: ${appUrl()}/settings/notifications`].filter(l => l !== null).join('\n')
  const html = baseTemplate({
    preheader: detail || title,
    body: `
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">${escapeHtml(title)}</h1>
      ${detail ? `<p style="margin:0 0 16px;color:#4b5563;">${escapeHtml(detail)}</p>` : ''}
      ${snippet ? `<p style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #e85002;background:#f9fafb;color:#374151;">${escapeHtml(snippet)}</p>` : ''}
      ${ctaButton('Открыть в Такте', opts.link)}
      ${settingsFooter()}
    `,
  })
  return { subject, html, text }
}

export type DigestItem = { title: string, detail: string, link: string }
export type DigestSection = { heading: string, items: DigestItem[], more: number }
export type DigestWorkspace = { id: string, name: string, sections: DigestSection[] }

export function digestEmail(opts: { recipientName: string, workspaces: DigestWorkspace[] }) {
  const total = opts.workspaces.reduce((n, w) => n + w.sections.reduce((m, s) => m + s.items.length + s.more, 0), 0)
  const subject = `Такт: ${total} ${plural(total, ['пункт', 'пункта', 'пунктов'])} на сегодня`
  const text = [
    `Доброе утро${opts.recipientName ? `, ${opts.recipientName}` : ''}! Вот что ждёт вас сегодня.`,
    ...opts.workspaces.flatMap(w => [
      '',
      `== ${w.name} ==`,
      ...w.sections.flatMap(s => [
        '',
        s.heading,
        ...s.items.map(i => `- ${i.title}${i.detail ? ` (${i.detail})` : ''}: ${i.link}`),
        ...(s.more ? [`- и ещё ${s.more}`] : []),
      ]),
    ]),
    '',
    `Настроить письма: ${appUrl()}/settings/notifications`,
  ].join('\n')
  const html = baseTemplate({
    preheader: subject,
    body: `
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">
        Доброе утро${opts.recipientName ? `, ${escapeHtml(opts.recipientName)}` : ''}!
      </h1>
      <p style="margin:0 0 24px;color:#4b5563;">Вот что ждёт вас сегодня.</p>
      ${opts.workspaces.map(w => `
        ${opts.workspaces.length > 1 ? `<h2 style="margin:24px 0 8px;font-size:15px;color:#111827;">${escapeHtml(w.name)}</h2>` : ''}
        ${w.sections.map(s => `
          <p style="margin:16px 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;">${escapeHtml(s.heading)}</p>
          ${s.items.map(i => `
            <p style="margin:0 0 6px;">
              <a href="${escapeHtml(i.link)}" style="color:#111827;font-weight:600;text-decoration:none;">${escapeHtml(i.title)}</a>
              ${i.detail ? `<span style="color:#6b7280;"> · ${escapeHtml(i.detail)}</span>` : ''}
            </p>`).join('')}
          ${s.more ? `<p style="margin:0 0 6px;color:#6b7280;">и ещё ${s.more}</p>` : ''}
        `).join('')}
      `).join('')}
      <div style="margin-top:28px;">${ctaButton('Открыть Входящие', `${appUrl()}/workspaces/${opts.workspaces[0]!.id}/inbox`)}</div>
      ${settingsFooter()}
    `,
  })
  return { subject, html, text }
}

function settingsFooter(): string {
  return `<p style="margin:28px 0 0;font-size:12px;color:#9ca3af;">
    Какие письма присылать, можно выбрать в <a href="${escapeHtml(`${appUrl()}/settings/notifications`)}" style="color:#6b7280;">настройках уведомлений</a>.
  </p>`
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}
