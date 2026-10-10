export type BoardPulse = {
  board: {
    id: string
    name: string
    sleDays: number | null
    replenishment: { lastAt: string | null; periodDays: number }
  }
  wip: { columnId: string; name: string; count: number; limit: number | null }[]
  aging: { count: number; p85Days: number | null }
  blockers: { count: number; longestDays: number | null }
  firings: { count: number; latestTrigger: string | null }
  myTasks: { open: number; inProgress: number }
  dueSoon: { taskId: string; title: string; dueDate: string } | null
  throughput7: number[]
  sprint: { id: string; name: string; pct: number; daysLeft: number; probability: number | null } | null
}
