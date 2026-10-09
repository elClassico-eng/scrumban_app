import { describe, expect, it } from 'vitest'
import {
  computeTaskFlow,
  summarizeFlow,
  type FlowEvent,
} from '../server/utils/flow-efficiency'

const h = (hours: number): Date => new Date(Date.UTC(2026, 0, 1, hours))
const col = (hours: number, columnId: string): FlowEvent => ({ at: h(hours), kind: 'column', columnId })
const blocked = (hours: number): FlowEvent => ({ at: h(hours), kind: 'blocked' })
const unblocked = (hours: number): FlowEvent => ({ at: h(hours), kind: 'unblocked' })

const QUEUES = new Set(['backlog', 'review'])

describe('computeTaskFlow', () => {
  it('splits time between queue columns and active columns', () => {
    const flow = computeTaskFlow(
      't1',
      [col(0, 'backlog'), col(10, 'dev'), col(14, 'review'), col(20, 'done')],
      h(20),
      QUEUES,
    )
    expect(flow.totalHours).toBe(20)
    expect(flow.queueHours).toBe(16)
    expect(flow.activeHours).toBe(4)
    expect(flow.blockedHours).toBe(0)
    expect(flow.waitByColumn).toEqual({ backlog: 10, review: 6 })
  })

  it('counts a block inside an active column as blocked wait', () => {
    const flow = computeTaskFlow(
      't1',
      [col(0, 'dev'), blocked(2), unblocked(5), col(10, 'done')],
      h(10),
      QUEUES,
    )
    expect(flow.activeHours).toBe(7)
    expect(flow.blockedHours).toBe(3)
    expect(flow.waitByColumn).toEqual({ dev: 3 })
  })

  it('does not double count a block inside a queue column', () => {
    const flow = computeTaskFlow(
      't1',
      [col(0, 'review'), blocked(1), unblocked(3), col(4, 'done')],
      h(4),
      QUEUES,
    )
    expect(flow.queueHours).toBe(4)
    expect(flow.blockedHours).toBe(0)
  })

  it('treats a block without unblock as lasting until close', () => {
    const flow = computeTaskFlow('t1', [col(0, 'dev'), blocked(6)], h(10), QUEUES)
    expect(flow.activeHours).toBe(6)
    expect(flow.blockedHours).toBe(4)
  })

  it('ignores events after close and sorts unordered input', () => {
    const flow = computeTaskFlow(
      't1',
      [col(5, 'review'), col(0, 'dev'), col(12, 'backlog')],
      h(8),
      QUEUES,
    )
    expect(flow.totalHours).toBe(8)
    expect(flow.activeHours).toBe(5)
    expect(flow.queueHours).toBe(3)
  })
})

describe('summarizeFlow', () => {
  it('weights efficiency by hours and aggregates wait per column', () => {
    const a = computeTaskFlow('a', [col(0, 'backlog'), col(10, 'dev'), col(20, 'done')], h(20), QUEUES)
    const b = computeTaskFlow('b', [col(0, 'dev'), blocked(2), unblocked(4), col(10, 'done')], h(10), QUEUES)
    const summary = summarizeFlow([a, b])
    expect(summary.totalHours).toBe(30)
    expect(summary.activeHours).toBe(18)
    expect(summary.efficiency).toBeCloseTo(0.6)
    expect(summary.waitByColumn).toEqual({ backlog: 10, dev: 2 })
  })

  it('returns zero efficiency for an empty sample', () => {
    const summary = summarizeFlow([])
    expect(summary.efficiency).toBe(0)
    expect(summary.totalHours).toBe(0)
  })
})
