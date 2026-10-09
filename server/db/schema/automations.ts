import { sql } from 'drizzle-orm'
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { boards } from './boards'
import { users } from './users'
import { workspaces } from './workspaces'

export const automationTrigger = pgEnum('automation_trigger', [
  'task_aging',
  'task_blocked',
  'sprint_forecast',
  'wip_exceeded',
  'replenishment_overdue',
])

export const automationAction = pgEnum('automation_action', ['notify', 'comment', 'daily_agenda'])

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    trigger: automationTrigger('trigger').notNull(),
    triggerParams: jsonb('trigger_params').$type<Record<string, unknown>>().notNull().default({}),
    action: automationAction('action').notNull(),
    actionParams: jsonb('action_params').$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('automation_rules_workspace_id_idx').on(t.workspaceId),
    index('automation_rules_board_id_idx').on(t.boardId),
  ],
)

export const automationFirings = pgTable(
  'automation_firings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'cascade' }),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('automation_firings_rule_resolved_idx').on(t.ruleId, t.resolvedAt),
    index('automation_firings_workspace_resolved_idx').on(t.workspaceId, t.resolvedAt),
    uniqueIndex('automation_firings_open_subject_uniq')
      .on(t.ruleId, t.subjectType, t.subjectId)
      .where(sql`resolved_at IS NULL`),
  ],
)

export type AutomationRuleRow = typeof automationRules.$inferSelect
export type AutomationFiringRow = typeof automationFirings.$inferSelect
