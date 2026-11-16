import { boolean, date, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { boards } from './boards'
import { users } from './users'
import { workspaces } from './workspaces'
import type { InstantNotificationType } from '../../../shared/types/notification'
import type { FeedEvent } from '../../../shared/types/integrations'

export const integrationProvider = pgEnum('integration_provider', ['pachca'])
export const integrationStatus = pgEnum('integration_status', ['active', 'error'])

export const workspaceIntegrations = pgTable(
  'workspace_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: integrationProvider('provider').notNull(),
    botTokenEnc: text('bot_token_enc').notNull(),
    signingSecretEnc: text('signing_secret_enc'),
    tokenHint: varchar('token_hint', { length: 8 }).notNull(),
    botUserId: varchar('bot_user_id', { length: 32 }).notNull(),
    externalName: varchar('external_name', { length: 255 }).notNull(),
    emailsVisible: boolean('emails_visible').notNull().default(false),
    status: integrationStatus('status').notNull().default('active'),
    lastError: text('last_error'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('workspace_integrations_ws_provider_uq').on(t.workspaceId, t.provider)],
)

export const messengerAccounts = pgTable(
  'messenger_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: integrationProvider('provider').notNull(),
    externalId: varchar('external_id', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    instantTypes: text('instant_types').array().$type<InstantNotificationType[]>().notNull()
      .default(['mention', 'reply', 'comment_assigned', 'assigned']),
    digest: boolean('digest').notNull().default(false),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('messenger_accounts_external_uq').on(t.provider, t.workspaceId, t.externalId),
    uniqueIndex('messenger_accounts_user_uq').on(t.userId, t.provider, t.workspaceId),
    index('messenger_accounts_workspace_idx').on(t.workspaceId),
  ],
)

export const messengerLinkRequests = pgTable(
  'messenger_link_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: integrationProvider('provider').notNull(),
    externalId: varchar('external_id', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('messenger_link_requests_user_idx').on(t.userId)],
)

export const boardFeeds = pgTable(
  'board_feeds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    provider: integrationProvider('provider').notNull(),
    chatId: varchar('chat_id', { length: 64 }).notNull(),
    chatName: varchar('chat_name', { length: 255 }).notNull(),
    events: text('events').array().$type<FeedEvent[]>().notNull(),
    standupTime: varchar('standup_time', { length: 5 }),
    standupSentOn: date('standup_sent_on', { mode: 'string' }),
    cursor: timestamp('cursor', { withTimezone: true }).notNull().defaultNow(),
    status: integrationStatus('status').notNull().default('active'),
    failingSince: timestamp('failing_since', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('board_feeds_board_chat_uq').on(t.boardId, t.provider, t.chatId),
    index('board_feeds_workspace_idx').on(t.workspaceId),
  ],
)

export type WorkspaceIntegration = typeof workspaceIntegrations.$inferSelect
export type MessengerAccount = typeof messengerAccounts.$inferSelect
export type BoardFeed = typeof boardFeeds.$inferSelect
