// Boards live inside a workspace. A board has ordered columns; tasks
// sit inside columns. board_columns carry a column_role enum that is
// independent of the user-facing column name — e.g. a team can rename
// "In Progress" → "Doing", but column_role='in_progress' stays so flow
// analytics (CFD, cycle time) doesn't break across teams.
//
// workspace_id is duplicated on board_columns (and tasks/task_events
// in tasks.ts) so RLS policies can do a flat "WHERE workspace_id = ..."
// without joining back to boards. The redundancy is checked at INSERT
// time in services.
import {
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    // Slug is unique only within a workspace, not globally.
    slug: varchar('slug', { length: 64 }).notNull(),
    sleDays: integer('sle_days'),
    sleProbability: decimal('sle_probability', { precision: 3, scale: 2 })
      .notNull()
      .default('0.85'),
    lastReplenishmentAt: timestamp('last_replenishment_at', { withTimezone: true }),
    replenishmentPeriodDays: integer('replenishment_period_days').notNull().default(7),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('boards_workspace_slug_idx').on(table.workspaceId, table.slug),
    index('boards_workspace_id_idx').on(table.workspaceId),
  ],
)

export type Board = typeof boards.$inferSelect
export type NewBoard = typeof boards.$inferInsert

// column_role categorises a column for analytics. User-facing name stays in
// `name`; analytics joins by role only.
export const columnRole = pgEnum('column_role', [
  'backlog',
  'in_progress',
  'review',
  'done',
  'archived',
])

export const boardColumns = pgTable(
  'board_columns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    // Sort order within the board. Service layer keeps these unique +
    // contiguous; the DB index just enforces uniqueness.
    position: integer('position').notNull(),
    // null = unbounded WIP. Service layer enforces the limit on task move.
    wipLimit: integer('wip_limit'),
    columnRole: columnRole('column_role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('board_columns_board_position_idx').on(table.boardId, table.position),
    index('board_columns_board_id_idx').on(table.boardId),
    index('board_columns_workspace_id_idx').on(table.workspaceId),
  ],
)

export type BoardColumn = typeof boardColumns.$inferSelect
export type NewBoardColumn = typeof boardColumns.$inferInsert
export type ColumnRole = (typeof columnRole.enumValues)[number]
