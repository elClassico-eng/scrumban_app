import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { workspaces } from './workspaces'

export const taskChecklistItems = pgTable(
  'task_checklist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    isDone: boolean('is_done').notNull().default(false),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('task_checklist_items_task_id_idx').on(table.taskId),
    index('task_checklist_items_workspace_id_idx').on(table.workspaceId),
  ],
)

export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect
export type NewTaskChecklistItem = typeof taskChecklistItems.$inferInsert