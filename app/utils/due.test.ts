import { describe, expect, it } from 'vitest'
import { endOfDayIso } from './calendar'
import { dueInfo } from './due'

function dayOffset(days: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

describe('dueInfo reads the stored UTC end-of-day as a calendar day', () => {
  it('yesterday is overdue by one day, never "today"', () => {
    const info = dueInfo(endOfDayIso(dayOffset(-1)))
    expect(info?.tone).toBe('overdue')
    expect(info?.diff).toBe(-1)
  })

  it('today and tomorrow keep their own day', () => {
    expect(dueInfo(endOfDayIso(dayOffset(0)))?.tone).toBe('today')
    expect(dueInfo(endOfDayIso(dayOffset(1)))?.diff).toBe(1)
  })
})
