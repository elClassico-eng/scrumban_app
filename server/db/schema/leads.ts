import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  team: varchar('team', { length: 200 }),
  intents: varchar('intents', { length: 64 }).notNull().default(''),
  teamSize: varchar('team_size', { length: 50 }),
  currentTool: varchar('current_tool', { length: 200 }),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  source: varchar('source', { length: 50 }).notNull().default('landing'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
