// Workspaces are tenants — every domain table (boards, tasks, sprints…)
// will eventually carry workspace_id and be filtered by RLS.
//
// workspace_members is the many-to-many join with users; it also stores
// the user's role within that specific workspace (so the same person can
// be Owner of one workspace and Viewer of another).
import {
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  // URL-friendly identifier (e.g. "acme"). Lowercase a-z, digits, hyphens.
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert

// Role hierarchy is documented in docs/uml/01-use-case/roles-guide.md.
// Higher roles inherit permissions of lower ones at the application layer
// (RBAC middleware), not at the DB level.
export const workspaceMemberRole = pgEnum('workspace_member_role', [
  'viewer',
  'member',
  'scrum_master',
  'admin',
  'owner',
])

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceMemberRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
)

export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
export type WorkspaceMemberRole = (typeof workspaceMemberRole.enumValues)[number]
