import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'
import { workspaces } from './workspaces'

export const taskWatchers = pgTable(
  'task_watchers',
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index('task_watchers_workspace_id_idx').on(table.workspaceId),
    index('task_watchers_user_id_idx').on(table.userId),
  ],
)

export type TaskWatcher = typeof taskWatchers.$inferSelect
export type NewTaskWatcher = typeof taskWatchers.$inferInsert
