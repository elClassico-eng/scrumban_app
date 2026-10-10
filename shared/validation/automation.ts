import { z } from 'zod'
import type { AutomationAction, AutomationSubjectType, AutomationTrigger } from '../types/automation'

export const AUTOMATION_TRIGGERS = [
  'task_aging',
  'task_blocked',
  'sprint_forecast',
  'wip_exceeded',
  'replenishment_overdue',
] as const

export const AUTOMATION_ACTIONS = ['notify', 'comment', 'daily_agenda'] as const

export const TRIGGER_SUBJECT: Record<AutomationTrigger, AutomationSubjectType> = {
  task_aging: 'task',
  task_blocked: 'task',
  sprint_forecast: 'sprint',
  wip_exceeded: 'column',
  replenishment_overdue: 'board',
}

export const ACTION_ALLOWED_FOR: Record<AutomationAction, AutomationSubjectType[]> = {
  notify: ['task', 'sprint', 'column', 'board'],
  comment: ['task'],
  daily_agenda: ['task', 'sprint', 'column', 'board'],
}

export const TRIGGER_PARAMS = {
  task_aging: z.object({ thresholdPct: z.number().int().min(50).max(200).default(85) }),
  task_blocked: z.object({ days: z.number().int().min(1).max(30).default(2) }),
  sprint_forecast: z.object({ minProbability: z.number().int().min(10).max(95).default(70) }),
  wip_exceeded: z.object({}),
  replenishment_overdue: z.object({}),
} as const

export const ACTION_PARAMS = {
  notify: z.object({ recipients: z.enum(['assignee', 'scrum_masters', 'all_members']) }),
  comment: z.object({}),
  daily_agenda: z.object({}),
} as const

export const RuleInputSchema = z
  .object({
    trigger: z.enum(AUTOMATION_TRIGGERS),
    triggerParams: z.record(z.string(), z.unknown()).default({}),
    action: z.enum(AUTOMATION_ACTIONS),
    actionParams: z.record(z.string(), z.unknown()).default({}),
    enabled: z.boolean().optional(),
  })
  .transform((v, ctx) => {
    const subject = TRIGGER_SUBJECT[v.trigger]
    if (!ACTION_ALLOWED_FOR[v.action].includes(subject)) {
      ctx.addIssue({ code: 'custom', message: 'Действие не подходит к триггеру', path: ['action'] })
      return z.NEVER
    }
    const tp = TRIGGER_PARAMS[v.trigger].safeParse(v.triggerParams)
    if (!tp.success) {
      ctx.addIssue({ code: 'custom', message: 'Неверные параметры триггера', path: ['triggerParams'] })
      return z.NEVER
    }
    const ap = ACTION_PARAMS[v.action].safeParse(v.actionParams)
    if (!ap.success) {
      ctx.addIssue({ code: 'custom', message: 'Неверные параметры действия', path: ['actionParams'] })
      return z.NEVER
    }
    const recipients = (ap.data as { recipients?: string }).recipients
    if (v.action === 'notify' && recipients === 'assignee' && subject !== 'task') {
      ctx.addIssue({ code: 'custom', message: 'Исполнитель есть только у задач', path: ['actionParams'] })
      return z.NEVER
    }
    return {
      trigger: v.trigger,
      action: v.action,
      enabled: v.enabled,
      triggerParams: tp.data as Record<string, unknown>,
      actionParams: ap.data as Record<string, unknown>,
    }
  })

export type RuleInputParsed = z.infer<typeof RuleInputSchema>
