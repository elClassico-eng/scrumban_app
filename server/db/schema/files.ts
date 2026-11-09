import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { boards } from './boards'
import { taskComments } from './comments'
import { tasks } from './tasks'
import { users } from './users'
import { workspaces } from './workspaces'

export const fileKind = pgEnum('file_kind', ['attachment', 'user_avatar', 'workspace_logo', 'board_image', 'user_background'])
export const fileStatus = pgEnum('file_status', ['pending', 'staged', 'ready'])

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: fileKind('kind').notNull(),
    status: fileStatus('status').notNull().default('pending'),
    forComment: boolean('for_comment').notNull().default(false),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => taskComments.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id').references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    thumbKey: text('thumb_key'),
    name: varchar('name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 127 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    thumbBytes: integer('thumb_bytes').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    index('files_workspace_idx').on(t.workspaceId),
    index('files_task_idx').on(t.taskId),
    index('files_comment_idx').on(t.commentId),
    index('files_status_created_idx').on(t.status, t.createdAt),
  ],
)

export const storageTrash = pgTable('storage_trash', {
  key: text('key').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type FileRow = typeof files.$inferSelect
