export type AgeBucket = 'fresh' | 'approaching' | 'overdue'

export function bucketAge(ageDays: number, p85: number | null): AgeBucket {
  if (p85 === null || p85 <= 0) return 'fresh'
  if (ageDays > p85) return 'overdue'
  if (ageDays >= 0.7 * p85) return 'approaching'
  return 'fresh'
}
