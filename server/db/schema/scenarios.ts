import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import type { ScenarioChange, ScenarioForecast } from '../../../shared/types/scenario'
import { sprints } from './sprints'
import { users } from './users'
import { workspaces } from './workspaces'

export const sprintScenarios = pgTable(
  'sprint_scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sprintId: uuid('sprint_id')
      .notNull()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    changes: jsonb('changes').$type<ScenarioChange[]>().notNull(),
    baselineResult: jsonb('baseline_result').$type<ScenarioForecast | null>(),
    scenarioResult: jsonb('scenario_result').$type<ScenarioForecast | null>(),
    computedAt: timestamp('computed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    appliedBy: uuid('applied_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sprint_scenarios_workspace_id_idx').on(table.workspaceId),
    index('sprint_scenarios_sprint_id_created_at_idx').on(table.sprintId, table.createdAt),
  ],
)

export type SprintScenarioRow = typeof sprintScenarios.$inferSelect
export type NewSprintScenarioRow = typeof sprintScenarios.$inferInsert
