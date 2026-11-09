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
