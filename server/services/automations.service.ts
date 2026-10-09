import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { AutomationFiring, AutomationRule } from '#shared/types/automation'
import type { RuleInputParsed } from '#shared/validation/automation'
import {
  automationFirings,
  automationRules,
  boards,
  taskComments,
  workspaceMembers,
  workspaces,
  type AutomationRuleRow,
  type WorkspaceMemberRole,
} from '../db/schema'
import { diffFirings, type Subject } from '../utils/automation-diff'
import { evaluateTrigger } from '../utils/automation-evaluators'
import { useDB, withTenant, type DbTransaction } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'
import { emitNotification } from './notifications.service'

const PRESETS: Omit<RuleInputParsed, 'enabled'>[] = [
  {
    trigger: 'task_aging',
    triggerParams: { thresholdPct: 85 },
    action: 'notify',
    actionParams: { recipients: 'assignee' },
  },
  {
    trigger: 'sprint_forecast',
    triggerParams: { minProbability: 70 },
    action: 'notify',
    actionParams: { recipients: 'scrum_masters' },
  },
  {
    trigger: 'replenishment_overdue',
    triggerParams: {},
    action: 'notify',
    actionParams: { recipients: 'scrum_masters' },
  },
]

export async function seedPresetRules(tx: DbTransaction, workspaceId: string, boardId: string): Promise<void> {
  await tx.insert(automationRules).values(PRESETS.map((p) => ({ workspaceId, boardId, ...p })))
}

export async function listRules(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<AutomationRule[]> {
  requireMinRole(input.actorRole, 'viewer')
  const rows = await withTenant(input.workspaceId, (tx) =>
    tx.execute<AutomationRule>(sql`
      SELECT
        r.id,
        r.workspace_id   AS "workspaceId",
        r.board_id       AS "boardId",
        r.trigger,
        r.trigger_params AS "triggerParams",
        r.action,
        r.action_params  AS "actionParams",
        r.enabled,
        r.created_by     AS "createdBy",
        r.created_at     AS "createdAt",
        r.updated_at     AS "updatedAt",
        (SELECT COUNT(*)::int FROM automation_firings f
          WHERE f.rule_id = r.id AND f.resolved_at IS NULL) AS "openFirings",
        (SELECT MAX(f.fired_at) FROM automation_firings f
          WHERE f.rule_id = r.id) AS "lastFiredAt"
      FROM automation_rules r
      WHERE r.board_id = ${input.boardId}
      ORDER BY r.created_at
    `),
  )
  return rows as unknown as AutomationRule[]
}

export async function createRule(input: {
  workspaceId: string
  boardId: string
  actorId: string
  actorRole: WorkspaceMemberRole
  input: RuleInputParsed
}): Promise<AutomationRuleRow> {
  requireMinRole(input.actorRole, 'scrum_master')
  const [row] = await withTenant(input.workspaceId, async (tx) => {
    const [board] = await tx.select({ id: boards.id }).from(boards).where(eq(boards.id, input.boardId))
    if (!board) throw new NotFoundError('Доска не найдена')
    return tx
      .insert(automationRules)
      .values({
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        createdBy: input.actorId,
        trigger: input.input.trigger,
        triggerParams: input.input.triggerParams,
        action: input.input.action,
        actionParams: input.input.actionParams,
        enabled: input.input.enabled ?? true,
      })
      .returning()
  })
  return row!
}

export async function getRule(input: {
  workspaceId: string
  ruleId: string
  actorRole: WorkspaceMemberRole
}): Promise<AutomationRuleRow> {
  requireMinRole(input.actorRole, 'viewer')
  const [row] = await withTenant(input.workspaceId, (tx) =>
    tx.select().from(automationRules).where(eq(automationRules.id, input.ruleId)),
  )
  if (!row) throw new NotFoundError('Правило не найдено')
  return row
}

export async function updateRule(input: {
  workspaceId: string
  ruleId: string
  actorRole: WorkspaceMemberRole
  patch: Partial<RuleInputParsed>
}): Promise<AutomationRuleRow> {
  requireMinRole(input.actorRole, 'scrum_master')
  const set: Partial<typeof automationRules.$inferInsert> = { updatedAt: new Date() }
  if (input.patch.trigger !== undefined) set.trigger = input.patch.trigger
  if (input.patch.triggerParams !== undefined) set.triggerParams = input.patch.triggerParams
  if (input.patch.action !== undefined) set.action = input.patch.action
  if (input.patch.actionParams !== undefined) set.actionParams = input.patch.actionParams
  if (input.patch.enabled !== undefined) set.enabled = input.patch.enabled
  const row = await withTenant(input.workspaceId, async (tx) => {
    const [prev] = await tx.select().from(automationRules).where(eq(automationRules.id, input.ruleId))
    if (!prev) throw new NotFoundError('Правило не найдено')
    const [updated] = await tx
      .update(automationRules)
      .set(set)
      .where(eq(automationRules.id, input.ruleId))
      .returning()
    const retargeted = set.trigger !== undefined && set.trigger !== prev.trigger
    if (set.enabled === false || retargeted) {
      await tx
        .update(automationFirings)
        .set({ resolvedAt: new Date() })
        .where(and(eq(automationFirings.ruleId, input.ruleId), isNull(automationFirings.resolvedAt)))
    }
    return updated!
  })
  return row
}

export async function deleteRule(input: {
  workspaceId: string
  ruleId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'scrum_master')
  const rows = await withTenant(input.workspaceId, (tx) =>
    tx.delete(automationRules).where(eq(automationRules.id, input.ruleId)).returning({ id: automationRules.id }),
  )
  if (rows.length === 0) throw new NotFoundError('Правило не найдено')
}

export async function listOpenFirings(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<AutomationFiring[]> {
  requireMinRole(input.actorRole, 'viewer')
  const rows = await withTenant(input.workspaceId, (tx) =>
    tx
      .select({
        id: automationFirings.id,
        ruleId: automationFirings.ruleId,
        trigger: automationRules.trigger,
        action: automationRules.action,
        subjectType: automationFirings.subjectType,
        subjectId: automationFirings.subjectId,
        payload: automationFirings.payload,
        firedAt: automationFirings.firedAt,
        resolvedAt: automationFirings.resolvedAt,
      })
      .from(automationFirings)
      .innerJoin(automationRules, eq(automationRules.id, automationFirings.ruleId))
      .where(and(eq(automationRules.boardId, input.boardId), isNull(automationFirings.resolvedAt)))
      .orderBy(desc(automationFirings.firedAt)),
  )
  return rows as unknown as AutomationFiring[]
}

export async function runBoard(workspaceId: string, boardId: string): Promise<{ opened: number; resolved: number }> {
  const rules = await withTenant(workspaceId, (tx) =>
    tx.select().from(automationRules).where(eq(automationRules.boardId, boardId)),
  )
  let opened = 0
  let resolved = 0
  for (const rule of rules) {
    try {
      const r = await runRule(workspaceId, boardId, rule)
      opened += r.opened
      resolved += r.resolved
    } catch (err) {
      console.error('[automations] rule failed', { ruleId: rule.id, trigger: rule.trigger, err })
    }
  }
  return { opened, resolved }
}

async function runRule(
  workspaceId: string,
  boardId: string,
  rule: AutomationRuleRow,
): Promise<{ opened: number; resolved: number }> {
  const current = rule.enabled
    ? await withTenant(workspaceId, (tx) =>
        evaluateTrigger(tx, { workspaceId, boardId, trigger: rule.trigger, params: rule.triggerParams }),
      )
    : []
  return withTenant(workspaceId, async (tx) => {
      const open = await tx
        .select({
          id: automationFirings.id,
          subjectType: automationFirings.subjectType,
          subjectId: automationFirings.subjectId,
        })
        .from(automationFirings)
        .where(and(eq(automationFirings.ruleId, rule.id), isNull(automationFirings.resolvedAt)))
      const diff = diffFirings(open, current)
      if (diff.toResolve.length > 0) {
        await tx
          .update(automationFirings)
          .set({ resolvedAt: new Date() })
          .where(inArray(automationFirings.id, diff.toResolve))
      }
      let openedNow = 0
      for (const s of diff.toOpen) {
        const inserted = await tx
          .insert(automationFirings)
          .values({
            workspaceId,
            ruleId: rule.id,
            subjectType: s.subjectType,
            subjectId: s.subjectId,
            payload: s.payload,
          })
          .onConflictDoNothing()
          .returning({ id: automationFirings.id })
        if (inserted.length === 0) continue
        await executeAction(tx, { workspaceId, rule, subject: s })
        openedNow += 1
      }
      return { opened: openedNow, resolved: diff.toResolve.length }
    })
}

export async function runAll(): Promise<{ opened: number; resolved: number }> {
  const wsList = await useDB().select({ id: workspaces.id }).from(workspaces)
  let opened = 0
  let resolved = 0
  for (const ws of wsList) {
    const boardIds = await withTenant(ws.id, (tx) => tx.select({ id: boards.id }).from(boards))
    for (const b of boardIds) {
      try {
        const r = await runBoard(ws.id, b.id)
        opened += r.opened
        resolved += r.resolved
      } catch (err) {
        console.error('[automations] board failed', { workspaceId: ws.id, boardId: b.id, err })
      }
    }
  }
  return { opened, resolved }
}

async function executeAction(
  tx: DbTransaction,
  input: { workspaceId: string; rule: AutomationRuleRow; subject: Subject },
): Promise<void> {
  const { rule, subject } = input
  const payload = {
    ruleId: rule.id,
    trigger: rule.trigger,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    ...subject.payload,
  }
  if (rule.action === 'notify') {
    const recipients = await resolveRecipients(input.workspaceId, String(rule.actionParams.recipients), subject)
    for (const userId of recipients) {
      await emitNotification({
        tx,
        workspaceId: input.workspaceId,
        recipientId: userId,
        actorId: null,
        type: 'automation',
        payload,
      })
    }
  } else if (rule.action === 'comment' && subject.subjectType === 'task') {
    await tx.insert(taskComments).values({
      workspaceId: input.workspaceId,
      taskId: subject.subjectId,
      authorId: null,
      automationRuleId: rule.id,
      body: commentBody(rule.trigger, subject.payload),
    })
  }
}

async function resolveRecipients(workspaceId: string, recipients: string, subject: Subject): Promise<string[]> {
  if (recipients === 'assignee') {
    const assigneeId = subject.payload.assigneeId
    return typeof assigneeId === 'string' ? [assigneeId] : []
  }
  const roleFilter =
    recipients === 'scrum_masters'
      ? sql`${workspaceMembers.role} IN ('owner', 'admin', 'scrum_master')`
      : sql`true`
  const rows = await useDB()
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), roleFilter))
  return rows.map((r) => r.userId)
}

function commentBody(trigger: string, p: Record<string, unknown>): string {
  switch (trigger) {
    case 'task_aging':
      return `Задача в колонке «${p.columnName}» уже ${p.ageDays} дн – это ${p.pct}% от SLE доски (${p.sleDays} дн).`
    case 'task_blocked':
      return `Блокер держится ${p.days} дн: ${p.reason}.`
    default:
      return 'Сработало правило автоматизации.'
  }
}
