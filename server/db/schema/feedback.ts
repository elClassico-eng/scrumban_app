import { sql } from 'drizzle-orm'
import { boolean, check, pgTable, smallint, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  liked: text('liked'),
  disliked: text('disliked'),
  missing: text('missing'),
  rating: smallint('rating'),
  email: varchar('email', { length: 255 }),
  team: varchar('team', { length: 200 }),
  wantsReply: boolean('wants_reply').notNull().default(false),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check('feedback_rating_range', sql`${t.rating} BETWEEN 1 AND 5`),
])

export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
