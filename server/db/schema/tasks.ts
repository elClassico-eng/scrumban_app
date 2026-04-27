// Tasks live inside a column. The column they sit in defines the lifecycle
// state (via column_role) — there is no separate `status` field on the task.
// Movement between columns is the source of all flow analytics.
//
// task_events is the append-only audit log: every state-changing operation
// (create, move, close, reopen, assign, archive) writes one row. Aggregates
// (CFD, cycle time, throughput) are derived from this log, never from the
// mutable tasks rows directly.
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'
import { boardColumns, boards } from './boards'

export const taskPriority = pgEnum('task_priority', ['low', 'medium', 'high'])

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    // restrict-on-delete: a column with tasks cannot be deleted; the service
    // must move/archive tasks first. Prevents silent data loss.
    columnId: uuid('column_id')
      .notNull()
      .references(() => boardColumns.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    // set null on user delete: a deleted user shouldn't drop tasks; the
    // task survives unassigned.
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    priority: taskPriority('priority').notNull().default('medium'),
    // Sort order within (board_id, column_id). Service rebalances on move.
    position: integer('position').notNull(),
    // Set when the task enters a column with column_role='done'.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    // Incremented when a task is moved out of done back into working states.
    reopenedCount: integer('reopened_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // RLS will filter on workspace_id; keep it indexed for both that and
    // workspace-wide queries.
    index('tasks_workspace_id_idx').on(table.workspaceId),
    // The board view (sorted column → tasks) is the hottest query path.
    index('tasks_board_column_position_idx').on(
      table.boardId,
      table.columnId,
      table.position,
    ),
    index('tasks_assignee_id_idx').on(table.assigneeId),
  ],
)

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert

export const taskEventType = pgEnum('task_event_type', [
  'task_created',
  'task_moved',
  'task_closed',
  'task_reopened',
  'task_assigned',
  'task_updated',
  'task_archived',
])

export const taskEvents = pgTable(
  'task_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    eventType: taskEventType('event_type').notNull(),
    fromColumnId: uuid('from_column_id'),
    toColumnId: uuid('to_column_id'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    // Free-form per-event metadata (e.g. {"oldPriority":"low","newPriority":"high"}).
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('task_events_workspace_id_idx').on(table.workspaceId),
    index('task_events_task_id_idx').on(table.taskId),
    // Time-ordered scans by tenant — the workhorse for CFD / Monte Carlo.
    index('task_events_workspace_created_idx').on(table.workspaceId, table.createdAt),
  ],
)

export type TaskEvent = typeof taskEvents.$inferSelect
export type NewTaskEvent = typeof taskEvents.$inferInsert
export type TaskEventType = (typeof taskEventType.enumValues)[number]
export type TaskPriority = (typeof taskPriority.enumValues)[number]
