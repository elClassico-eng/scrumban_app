export function shouldSkipDailySnapshot(lastDailyTakenAt: Date | null, now: Date): boolean {
  if (lastDailyTakenAt === null) return false
  return lastDailyTakenAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
}
