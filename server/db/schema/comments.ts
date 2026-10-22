import { index, pgTable, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'
import { tasks } from './tasks'
import { automationRules } from './automations'

export const taskComments = pgTable(
  'task_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    automationRuleId: uuid('automation_rule_id').references(() => automationRules.id, { onDelete: 'set null' }),
    // One level of threading: replies always point at the root comment.
    parentId: uuid('parent_id').references((): AnyPgColumn => taskComments.id, { onDelete: 'cascade' }),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('task_comments_workspace_id_idx').on(table.workspaceId),
    index('task_comments_task_created_idx').on(table.taskId, table.createdAt),
    index('task_comments_assignee_idx').on(table.workspaceId, table.assigneeId, table.resolvedAt),
  ],
)

export type TaskComment = typeof taskComments.$inferSelect
export type NewTaskComment = typeof taskComments.$inferInsert