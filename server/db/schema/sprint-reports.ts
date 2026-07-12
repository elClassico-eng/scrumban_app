import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sprints } from './sprints'
import { users } from './users'
import { workspaces } from './workspaces'

export const sprintReports = pgTable(
  'sprint_reports',
  {
    sprintId: uuid('sprint_id')
      .primaryKey()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    generatedBy: uuid('generated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [index('sprint_reports_workspace_id_idx').on(table.workspaceId)],
)

export type SprintReportRow = typeof sprintReports.$inferSelect
export type NewSprintReportRow = typeof sprintReports.$inferInsert
