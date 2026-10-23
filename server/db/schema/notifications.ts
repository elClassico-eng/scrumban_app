import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'

export const notificationType = pgEnum('notification_type', [
  'mention',
  'assigned',
  'comment_on_assigned',
  'sle_breach',
  'replenishment_overdue',
  'sprint_forecast_drop',
  'automation',
  'reply',
  'comment_assigned',
  'watched_comment',
  'watched_status',
])

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    // Cleared = handled and out of the queue; read only means seen.
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_read_idx').on(table.userId, table.readAt, table.createdAt),
    index('notifications_workspace_id_idx').on(table.workspaceId),
    index('notifications_user_ws_cleared_idx').on(table.userId, table.workspaceId, table.clearedAt, table.createdAt),
  ],
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type NotificationType = (typeof notificationType.enumValues)[number]