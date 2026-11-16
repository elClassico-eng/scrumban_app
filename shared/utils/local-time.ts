const RESEND_GAP_MS = 20 * 3_600_000

export function localParts(d: Date, timeZone: string): { day: string, hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map(p => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

export function isDigestDue(input: { now: Date, timeZone: string, digestHour: number, lastSentAt: Date | null }): boolean {
  if (localParts(input.now, input.timeZone).hour !== input.digestHour) return false
  return !input.lastSentAt || input.now.getTime() - input.lastSentAt.getTime() > RESEND_GAP_MS
}

const DAY_MS = 86_400_000

// Due dates are calendar days stored as YYYY-MM-DDT23:59:59Z, so the day comes
// from the UTC parts; only "today" depends on the reader's zone.
export function dueBucket(dueDate: Date, now: Date, timeZone: string): { kind: 'today' } | { kind: 'overdue', days: number } | null {
  const dueDay = dueDate.toISOString().slice(0, 10)
  const today = localParts(now, timeZone).day
  if (dueDay === today) return { kind: 'today' }
  if (dueDay < today) return { kind: 'overdue', days: (Date.parse(today) - Date.parse(dueDay)) / DAY_MS }
  return null
}

export const DEFAULT_TIME_ZONE = 'Europe/Moscow'

export function shouldSyncZone(input: { userZone: string, browserZone: string | undefined, synced: boolean }): boolean {
  return !input.synced && input.userZone === DEFAULT_TIME_ZONE && !!input.browserZone && input.browserZone !== input.userZone
}
