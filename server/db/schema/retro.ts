import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sprints } from './sprints'
import { tasks } from './tasks'
import { users } from './users'
import { workspaces } from './workspaces'

export const retroCategory = pgEnum('retro_category', [
  'went_well',
  'to_improve',
  'action_item',
])
export type RetroCategory = (typeof retroCategory.enumValues)[number]

export const sprintRetroNotes = pgTable(
  'sprint_retro_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sprintId: uuid('sprint_id')
      .notNull()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    category: retroCategory('category').notNull(),
    body: text('body').notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    convertedTaskId: uuid('converted_task_id').references(() => tasks.id, { onDelete: 'set null' }),
    isResolved: boolean('is_resolved').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sprint_retro_notes_workspace_id_idx').on(table.workspaceId),
    index('sprint_retro_notes_sprint_id_created_at_idx').on(table.sprintId, table.createdAt),
  ],
)

export type SprintRetroNote = typeof sprintRetroNotes.$inferSelect
export type NewSprintRetroNote = typeof sprintRetroNotes.$inferInsert
