export type AutomationTrigger =
  | 'task_aging'
  | 'task_blocked'
  | 'sprint_forecast'
  | 'wip_exceeded'
  | 'replenishment_overdue'

export type AutomationAction = 'notify' | 'comment' | 'daily_agenda'

export type AutomationSubjectType = 'task' | 'sprint' | 'column' | 'board'

export type NotifyRecipients = 'assignee' | 'scrum_masters' | 'all_members'

export type AutomationRule = {
  id: string
  workspaceId: string
  boardId: string
  trigger: AutomationTrigger
  triggerParams: Record<string, unknown>
  action: AutomationAction
  actionParams: Record<string, unknown>
  enabled: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  openFirings: number
  lastFiredAt: string | null
}

export type AutomationFiring = {
  id: string
  ruleId: string
  trigger: AutomationTrigger
  action: AutomationAction
  subjectType: AutomationSubjectType
  subjectId: string
  payload: Record<string, unknown>
  firedAt: string
  resolvedAt: string | null
}

export type RuleInput = {
  trigger: AutomationTrigger
  triggerParams: Record<string, unknown>
  action: AutomationAction
  actionParams: Record<string, unknown>
  enabled?: boolean
}

export type AutomationRulesResponse = { rules: AutomationRule[] }
export type AutomationRuleResponse = { rule: AutomationRule }
export type AutomationFiringsResponse = { firings: AutomationFiring[] }
export type AutomationRunResponse = { opened: number; resolved: number }
