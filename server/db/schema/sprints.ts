// Sprints are time-boxed work iterations. A sprint belongs to one board
// and can contain a subset of that board's tasks (via sprint_tasks).
// State machine:
//   planned → active   via "start" endpoint  (sets started_at)
//   active  → closed   via "close" endpoint  (sets ended_at, freezes
//                                              velocity for analytics)
//   planned → closed   shortcut for cancelling a never-started sprint
//
// workspace_id is duplicated on both tables so RLS policies stay flat.
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { boards } from './boards'
import { tasks } from './tasks'
import { workspaces } from './workspaces'

export const sprintState = pgEnum('sprint_state', ['planned', 'active', 'closed'])
export type SprintState = (typeof sprintState.enumValues)[number]

export const sprints = pgTable(
  'sprints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    // Free-form sprint goal — what the team is committing to.
    goal: text('goal').notNull().default(''),
    state: sprintState('state').notNull().default('planned'),
    // Plan: target window for the sprint. plannedStart may be set when
    // creating a planned sprint; startedAt / endedAt are filled by
    // start / close transitions and are the source of truth for
    // duration analytics.
    plannedStartAt: timestamp('planned_start_at', { withTimezone: true }),
    plannedEndAt: timestamp('planned_end_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sprints_workspace_id_idx').on(table.workspaceId),
    index('sprints_board_id_idx').on(table.boardId),
    // For any board, only ONE sprint may be active at a time. Enforced
    // via a partial unique index that only sees rows with state='active'.
    uniqueIndex('sprints_one_active_per_board_idx')
      .on(table.boardId)
      .where(sql`state = 'active'`),
  ],
)

export type Sprint = typeof sprints.$inferSelect
export type NewSprint = typeof sprints.$inferInsert

// M:N between sprints and tasks. A task can sit in multiple sprints across
// time (carry-over), but typically only one sprint per task. The composite
// PK prevents accidental duplicates.
export const sprintTasks = pgTable(
  'sprint_tasks',
  {
    sprintId: uuid('sprint_id')
      .notNull()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sprintId, table.taskId] }),
    index('sprint_tasks_task_id_idx').on(table.taskId),
    index('sprint_tasks_workspace_id_idx').on(table.workspaceId),
  ],
)

export type SprintTask = typeof sprintTasks.$inferSelect
export type NewSprintTask = typeof sprintTasks.$inferInsert

// `sql` re-export so the partial-index `where` above can use raw SQL
// without us pulling drizzle-orm/sql through every consumer of this file.
import { sql } from 'drizzle-orm'
