import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { boards } from './boards'
import { sprints } from './sprints'
import { workspaces } from './workspaces'

export const forecastTrigger = pgEnum('forecast_trigger', ['sprint_start', 'sprint_close', 'daily'])
export type ForecastTrigger = (typeof forecastTrigger.enumValues)[number]

export const forecastSnapshots = pgTable(
  'forecast_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    sprintId: uuid('sprint_id')
      .notNull()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    trigger: forecastTrigger('trigger').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb('payload').notNull().default({}),
  },
  table => [
    index('forecast_snapshots_sprint_id_taken_at_idx').on(table.sprintId, table.takenAt),
    index('forecast_snapshots_workspace_id_idx').on(table.workspaceId),
  ],
)

export type ForecastSnapshot = typeof forecastSnapshots.$inferSelect
export type NewForecastSnapshot = typeof forecastSnapshots.$inferInsert
