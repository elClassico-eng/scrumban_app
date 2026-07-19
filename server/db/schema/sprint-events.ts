import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sprints } from './sprints'
import { users } from './users'
import { workspaces } from './workspaces'

export const sprintEventType = pgEnum('sprint_event_type', [
  'sprint_started',
  'sprint_closed',
  'dates_changed',
  'capacity_changed',
])
export type SprintEventType = (typeof sprintEventType.enumValues)[number]

export const sprintEvents = pgTable(
  'sprint_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sprintId: uuid('sprint_id')
      .notNull()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    eventType: sprintEventType('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sprint_events_workspace_id_idx').on(table.workspaceId),
    index('sprint_events_sprint_id_created_at_idx').on(table.sprintId, table.createdAt),
  ],
)

export type SprintEvent = typeof sprintEvents.$inferSelect
export type NewSprintEvent = typeof sprintEvents.$inferInsert
