export type NotificationType =
  | 'mention'
  | 'assigned'
  | 'comment_on_assigned'
  | 'sle_breach'
  | 'replenishment_overdue'
  | 'sprint_forecast_drop'

export interface Notification {
  id: string
  workspaceId: string
  userId: string
  type: NotificationType
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export interface NotificationListResponse {
  notifications: Notification[]
}

export interface NotificationResponse {
  notification: Notification
}

export interface NotificationUnreadCountResponse {
  count: number
}

export interface MarkAllReadInput {
  workspaceId?: string
}

export interface MarkAllReadResponse {
  count: number
}