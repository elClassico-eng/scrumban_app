// Tasks live inside a column. The column they sit in defines the lifecycle
// state (via column_role) — there is no separate `status` field on the task.
// Movement between columns is the source of all flow analytics.
//
// task_events is the append-only audit log: every state-changing operation
// (create, move, close, reopen, assign, archive) writes one row. Aggregates
// (CFD, cycle time, throughput) are derived from this log, never from the
// mutable tasks rows directly.
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'
import { boardColumns, boards } from './boards'

export const serviceClass = pgEnum('service_class', [
  'expedite',
  'fixed_date',
  'standard',
  'intangible',
])

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
    serviceClass: serviceClass('service_class').notNull().default('standard'),
    // Target deadline for service_class='fixed_date' tasks. NULL for other
    // classes. Service layer validates fixed_date always has a due_date.
    dueDate: timestamp('due_date', { withTimezone: true }),
    // Set when a task is promoted to service_class='expedite'. Lets us
    // measure "how long did we know this was urgent before it closed".
    expeditedAt: timestamp('expedited_at', { withTimezone: true }),
    // Sort order within (board_id, column_id). Service rebalances on move.
    position: integer('position').notNull(),
    // Set when the task enters a column with column_role='done'.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    // Incremented when a task is moved out of done back into working states.
    reopenedCount: integer('reopened_count').notNull().default(0),
    parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, {
      onDelete: 'set null',
    }),
    blockedReason: text('blocked_reason'),
    isEpic: boolean('is_epic').notNull().default(false),
    storyPoints: integer('story_points'),
    // Manual duration estimate in days. When set, the network-planning layer
    // uses it as the most-likely (M) value instead of the historical median,
    // scaling O/P proportionally to keep the uncertainty shape.
    estimateDays: doublePrecision('estimate_days'),
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
    // Per-CoS analytics (throughput per class, etc.) — Phase 8.
    index('tasks_board_service_class_idx').on(table.boardId, table.serviceClass),
    // "Show me children of X" — Phase 6 subtask drawer.
    index('tasks_parent_task_id_idx').on(table.parentTaskId),
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
  'task_commented',
  'task_comment_deleted',
  'task_added_to_sprint',
  'task_removed_from_sprint',
  'task_blocked',
  'task_unblocked',
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
export type ServiceClass = (typeof serviceClass.enumValues)[number]

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    blockerTaskId: uuid('blocker_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    blockedTaskId: uuid('blocked_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerTaskId, table.blockedTaskId] }),
    index('task_dependencies_blocker_idx').on(table.blockerTaskId),
    index('task_dependencies_blocked_idx').on(table.blockedTaskId),
    index('task_dependencies_workspace_id_idx').on(table.workspaceId),
    check('task_dependencies_no_self_block', sql`blocker_task_id <> blocked_task_id`),
  ],
)

export type TaskDependency = typeof taskDependencies.$inferSelect
export type NewTaskDependency = typeof taskDependencies.$inferInsert
