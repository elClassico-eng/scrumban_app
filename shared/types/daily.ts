export type DailyStat = { value: number; delta: number }

export type DailyAgingTask = {
  taskId: string
  title: string
  columnId: string
  columnName: string
  ageDays: number
  overP85Days: number
  assigneeIds: string[]
}

export type DailyHeatmapRow = {
  columnId: string
  columnName: string
  fresh: number
  approaching: number
  overdue: number
}

export type DailyBlocker = {
  taskId: string
  title: string
  reason: string | null
  blockedDays: number
  sinceISO: string | null
}

export type DailyWipViolation = {
  columnId: string
  columnName: string
  count: number
  limit: number
}

export type DailySprintRisk = {
  sprintId: string
  sprintName: string
  horizonDays: number | null
  atRisk: { taskId: string; title: string; ageDays: number }[]
}

export type DailyChangeKind =
  | 'closed'
  | 'moved'
  | 'blocked'
  | 'unblocked'
  | 'added_to_sprint'
  | 'removed_from_sprint'

export type DailyChangeItem = {
  taskId: string
  title: string
  kind: DailyChangeKind
  atISO: string
}

export type DailyDigest = {
  stats: {
    done: DailyStat
    wip: DailyStat
    blocked: DailyStat
    aging: DailyStat
  }
  p85Days: number | null
  aging: DailyAgingTask[]
  heatmap: DailyHeatmapRow[]
  blockers: DailyBlocker[]
  wipViolations: DailyWipViolation[]
  sprintRisk: DailySprintRisk | null
  changes: Record<DailyChangeKind, number>
  changeItems: DailyChangeItem[]
}
