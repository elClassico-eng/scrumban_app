import type { NotificationType } from '../types/notification'

export const INBOX_VIEWS = ['primary', 'flow', 'later', 'cleared'] as const
export type InboxView = (typeof INBOX_VIEWS)[number]

export const PRIMARY_TYPES: NotificationType[] = ['mention', 'reply', 'comment_assigned', 'assigned', 'comment_on_assigned']
export const FLOW_TYPES: NotificationType[] = ['sle_breach', 'replenishment_overdue', 'sprint_forecast_drop', 'automation', 'watched_comment', 'watched_status']
