import { pgTable, uuid, text, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  ip: varchar('ip', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('user_sessions_user_id_idx').on(table.userId)])

export type UserSession = typeof userSessions.$inferSelect
