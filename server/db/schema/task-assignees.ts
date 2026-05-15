import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'
import { workspaces } from './workspaces'

export const taskAssignees = pgTable(
  'task_assignees',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index('task_assignees_workspace_id_idx').on(table.workspaceId),
    index('task_assignees_user_id_idx').on(table.userId),
  ],
)

export type TaskAssignee = typeof taskAssignees.$inferSelect
export type NewTaskAssignee = typeof taskAssignees.$inferInsert
