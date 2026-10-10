import { describe, expect, it } from 'vitest'
import { RuleInputSchema } from '../shared/validation/automation'

describe('RuleInputSchema', () => {
  it('accepts task trigger with assignee notify', () => {
    const r = RuleInputSchema.safeParse({
      trigger: 'task_aging',
      triggerParams: { thresholdPct: 85 },
      action: 'notify',
      actionParams: { recipients: 'assignee' },
    })
    expect(r.success).toBe(true)
  })

  it('fills default params', () => {
    const r = RuleInputSchema.parse({
      trigger: 'task_blocked',
      triggerParams: {},
      action: 'daily_agenda',
      actionParams: {},
    })
    expect(r.triggerParams).toEqual({ days: 2 })
  })

  it('rejects comment on sprint trigger', () => {
    const r = RuleInputSchema.safeParse({
      trigger: 'sprint_forecast',
      triggerParams: { minProbability: 70 },
      action: 'comment',
      actionParams: {},
    })
    expect(r.success).toBe(false)
  })

  it('rejects assignee recipients on column trigger', () => {
    const r = RuleInputSchema.safeParse({
      trigger: 'wip_exceeded',
      triggerParams: {},
      action: 'notify',
      actionParams: { recipients: 'assignee' },
    })
    expect(r.success).toBe(false)
  })

  it('rejects out of range threshold', () => {
    const r = RuleInputSchema.safeParse({
      trigger: 'task_aging',
      triggerParams: { thresholdPct: 500 },
      action: 'notify',
      actionParams: { recipients: 'scrum_masters' },
    })
    expect(r.success).toBe(false)
  })
})
