import { describe, expect, it } from 'vitest'
import { isDigestDue, localParts } from '#shared/utils/local-time'

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
