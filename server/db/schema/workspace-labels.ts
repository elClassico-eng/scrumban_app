import { index, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'

export const workspaceUserLabels = pgTable(
  'workspace_user_labels',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.workspaceId] }),
    index('workspace_user_labels_user_id_idx').on(table.userId),
  ],
)

export type WorkspaceUserLabel = typeof workspaceUserLabels.$inferSelect
export type NewWorkspaceUserLabel = typeof workspaceUserLabels.$inferInsert