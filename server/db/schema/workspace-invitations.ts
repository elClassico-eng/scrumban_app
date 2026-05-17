import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces, workspaceMemberRole } from './workspaces'

export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  role: workspaceMemberRole('role').notNull(),
  email: varchar('email', { length: 255 }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('workspace_invitations_workspace_id_idx').on(table.workspaceId),
])

export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect
export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert