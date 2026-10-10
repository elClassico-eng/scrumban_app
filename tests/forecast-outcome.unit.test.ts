import { describe, expect, it } from 'vitest'
import { reliabilityFor, resolveOutcome } from '../server/utils/forecast-outcome'

const start = { simulation: { p50Days: 5, p85Days: 8, p95Days: 10 } } as never
const closeAt = (lastDoneAt: string | null, carriedCount = 0) =>
  ({ resolution: { totalCount: 3, doneCount: carriedCount ? 2 : 3, totalSp: 0, doneSp: 0, lastDoneAt, carriedCount } }) as never
const startedAt = new Date('2026-10-01T00:00:00Z')

describe('resolveOutcome', () => {
  it('hit when last task closed within p85', () => {
    expect(resolveOutcome({ startedAt, start, close: closeAt('2026-10-07T12:00:00Z') })).toEqual({
      outcome: 'hit',
      actualDays: 6.5,
      p50Hit: false,
      p85Hit: true,
    })
  })

  it('miss when last task closed after p85', () => {
    expect(resolveOutcome({ startedAt, start, close: closeAt('2026-10-10T00:00:00Z') }).outcome).toBe('miss')
  })

  it('carryover is a miss on both percentiles', () => {
    expect(resolveOutcome({ startedAt, start, close: closeAt(null, 1) })).toEqual({
      outcome: 'carryover',
      actualDays: null,
      p50Hit: false,
      p85Hit: false,
    })
  })

  it('unknown without start snapshot, without carriedCount, or without close', () => {
    expect(resolveOutcome({ startedAt, start: null, close: closeAt('2026-10-07T00:00:00Z') }).outcome).toBe('unknown')
    const legacy = { resolution: { totalCount: 1, doneCount: 1, totalSp: 0, doneSp: 0 } } as never
    expect(resolveOutcome({ startedAt, start, close: legacy }).outcome).toBe('unknown')
    expect(resolveOutcome({ startedAt, start, close: null }).outcome).toBe('unknown')
    expect(resolveOutcome({ startedAt: null, start, close: closeAt('2026-10-07T00:00:00Z') }).outcome).toBe('unknown')
  })

  it('tasks all closed before the sprint started are unknown, not a hit', () => {
    expect(resolveOutcome({ startedAt, start, close: closeAt('2026-09-30T00:00:00Z') }).outcome).toBe('unknown')
  })

  it('empty sprint is unknown', () => {
    const empty = { resolution: { totalCount: 0, doneCount: 0, totalSp: 0, doneSp: 0, lastDoneAt: null, carriedCount: 0 } } as never
    expect(resolveOutcome({ startedAt, start, close: empty }).outcome).toBe('unknown')
  })
})

describe('reliabilityFor', () => {
  it('thresholds', () => {
    expect(reliabilityFor(0)).toBe('insufficient')
    expect(reliabilityFor(4)).toBe('insufficient')
    expect(reliabilityFor(5)).toBe('low')
    expect(reliabilityFor(9)).toBe('low')
    expect(reliabilityFor(10)).toBe('ok')
  })
})
