import { INSTANT_NOTIFICATION_TYPES, type InstantNotificationType, type NotificationType } from '../types/notification'
import { PRIMARY_TYPES } from './notification-category'

export type NotificationMode = 'all' | 'important' | 'mine' | 'quiet'
export type ChannelMatrix = {
  bell: Record<NotificationType, boolean>
  email: InstantNotificationType[]
  pachca: InstantNotificationType[]
}
export type MatrixGroup = 'Про меня' | 'Поток' | 'Наблюдаю' | 'Система'

export const MATRIX_ROWS: { group: MatrixGroup, type: NotificationType, label: string }[] = [
  { group: 'Про меня', type: 'mention', label: 'Упомянули' },
  { group: 'Про меня', type: 'assigned', label: 'Назначили задачу' },
  { group: 'Про меня', type: 'reply', label: 'Ответили в моей ветке' },
  { group: 'Про меня', type: 'comment_assigned', label: 'Поручение в комментарии' },
  { group: 'Про меня', type: 'comment_on_assigned', label: 'Комментарий к моей задаче' },
  { group: 'Поток', type: 'sle_breach', label: 'Задача вышла за SLE' },
  { group: 'Поток', type: 'replenishment_overdue', label: 'Пора пополнить backlog' },
  { group: 'Поток', type: 'sprint_forecast_drop', label: 'Прогноз спринта упал' },
  { group: 'Наблюдаю', type: 'watched_comment', label: 'Комментарии там, где я наблюдатель' },
  { group: 'Наблюдаю', type: 'watched_status', label: 'Смена статуса там, где я наблюдатель' },
  { group: 'Система', type: 'automation', label: 'Автоматизации доски' },
  { group: 'Система', type: 'integration_failed', label: 'Сбои интеграций' },
]

const ALL_TYPES = MATRIX_ROWS.map(r => r.type)
const WATCHED: NotificationType[] = ['watched_comment', 'watched_status']
const INSTANT = INSTANT_NOTIFICATION_TYPES as readonly NotificationType[]

function bellWhere(on: (t: NotificationType) => boolean): ChannelMatrix['bell'] {
  return Object.fromEntries(ALL_TYPES.map(t => [t, on(t)])) as ChannelMatrix['bell']
}

const PRIMARY_INSTANT = INSTANT_NOTIFICATION_TYPES.filter(t => PRIMARY_TYPES.includes(t))

export function matrixForMode(mode: NotificationMode, current: ChannelMatrix): ChannelMatrix {
  switch (mode) {
    case 'all':
      return { bell: bellWhere(() => true), email: [...INSTANT_NOTIFICATION_TYPES], pachca: [...INSTANT_NOTIFICATION_TYPES] }
    case 'important':
      return { bell: bellWhere(t => !WATCHED.includes(t)), email: ['mention', 'assigned'], pachca: ['mention', 'assigned'] }
    case 'mine':
      return { bell: bellWhere(t => PRIMARY_TYPES.includes(t)), email: [], pachca: [...PRIMARY_INSTANT] }
    case 'quiet':
      return { bell: { ...current.bell }, email: [], pachca: [] }
  }
}

function sameMatrix(a: ChannelMatrix, b: ChannelMatrix, ignorePachca: boolean): boolean {
  const key = (x: ChannelMatrix) => JSON.stringify([
    bellWhere(t => x.bell[t] !== false),
    [...x.email].sort(),
    ignorePachca ? [] : [...x.pachca].sort(),
  ])
  return key(a) === key(b)
}

export function detectMode(m: ChannelMatrix, opts: { ignorePachca?: boolean } = {}): NotificationMode | 'custom' {
  const exact = (['all', 'important', 'mine'] as const).find(mode => sameMatrix(m, matrixForMode(mode, m), !!opts.ignorePachca))
  if (exact) return exact
  return !m.email.length && (opts.ignorePachca || !m.pachca.length) ? 'quiet' : 'custom'
}

export function cellEnabled(m: ChannelMatrix, type: NotificationType, _channel: 'email' | 'pachca'): boolean {
  return INSTANT.includes(type) && m.bell[type] !== false
}

export function pachcaCellState(links: { instantTypes: InstantNotificationType[] }[], type: InstantNotificationType): 'on' | 'off' | 'mixed' {
  const on = links.filter(l => l.instantTypes.includes(type)).length
  if (on === 0) return 'off'
  return on === links.length ? 'on' : 'mixed'
}
