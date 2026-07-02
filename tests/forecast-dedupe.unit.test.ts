import { describe, expect, it } from 'vitest'
import { shouldSkipDailySnapshot } from '../server/utils/forecast-dedupe'

describe('shouldSkipDailySnapshot', () => {
  it('does not skip when there is no previous daily snapshot', () => {
    expect(shouldSkipDailySnapshot(null, new Date('2026-07-02T10:00:00Z'))).toBe(false)
  })

  it('skips second snapshot within the same UTC day', () => {
    const last = new Date('2026-07-02T03:00:00Z')
    const now = new Date('2026-07-02T23:59:59Z')
    expect(shouldSkipDailySnapshot(last, now)).toBe(true)
  })

  it('does not skip on the next UTC day even one second later', () => {
    const last = new Date('2026-07-02T23:59:59Z')
    const now = new Date('2026-07-03T00:00:00Z')
    expect(shouldSkipDailySnapshot(last, now)).toBe(false)
  })

  it('uses UTC days, not local (23:00Z and 01:00Z next day differ)', () => {
    const last = new Date('2026-07-02T23:00:00Z')
    const now = new Date('2026-07-03T01:00:00Z')
    expect(shouldSkipDailySnapshot(last, now)).toBe(false)
  })
})
