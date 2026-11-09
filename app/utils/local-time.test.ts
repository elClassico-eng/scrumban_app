import { describe, expect, it } from 'vitest'
import { dueBucket, isDigestDue, localParts } from '#shared/utils/local-time'

const at = (iso: string) => new Date(iso)

describe('localParts', () => {
  it('shifts the day and hour into the zone', () => {
    expect(localParts(at('2026-11-09T22:30:00Z'), 'Europe/Moscow')).toEqual({ day: '2026-11-10', hour: 1 })
    expect(localParts(at('2026-11-09T22:30:00Z'), 'Pacific/Honolulu')).toEqual({ day: '2026-11-09', hour: 12 })
  })
})

describe('isDigestDue', () => {
  const base = { timeZone: 'Europe/Moscow', digestHour: 9 }

  it('fires in the chosen local hour when nothing was sent', () => {
    expect(isDigestDue({ ...base, now: at('2026-11-10T06:05:00Z'), lastSentAt: null })).toBe(true)
  })

  it('does not fire twice within the same day', () => {
    expect(isDigestDue({ ...base, now: at('2026-11-10T06:05:00Z'), lastSentAt: at('2026-11-10T05:05:00Z') })).toBe(false)
  })

  it('waits for the chosen hour', () => {
    expect(isDigestDue({ ...base, now: at('2026-11-10T07:05:00Z'), lastSentAt: null })).toBe(false)
  })
})

describe('dueBucket reads the due date as a calendar day and "today" in the zone', () => {
  const due = (day: string) => new Date(`${day}T23:59:59Z`)

  it('Moscow morning: a task due today is today, not tomorrow', () => {
    expect(dueBucket(due('2026-11-09'), at('2026-11-09T06:05:00Z'), 'Europe/Moscow')).toEqual({ kind: 'today' })
  })

  it('a task due yesterday is overdue by one day', () => {
    expect(dueBucket(due('2026-11-08'), at('2026-11-09T06:05:00Z'), 'Europe/Moscow')).toEqual({ kind: 'overdue', days: 1 })
  })

  it('UTC+12 and UTC-10 use their own today', () => {
    expect(dueBucket(due('2026-11-10'), at('2026-11-09T21:05:00Z'), 'Pacific/Auckland')).toEqual({ kind: 'today' })
    expect(dueBucket(due('2026-11-09'), at('2026-11-09T19:05:00Z'), 'Pacific/Honolulu')).toEqual({ kind: 'today' })
  })

  it('future tasks are not in the digest', () => {
    expect(dueBucket(due('2026-11-12'), at('2026-11-09T06:05:00Z'), 'Europe/Moscow')).toBeNull()
  })
})
