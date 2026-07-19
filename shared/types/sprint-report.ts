import type { ServiceClass } from './domain'

export type SprintReportScopeChange = {
  taskId: string
  title: string
  kind: 'added' | 'removed'
  atISO: string
  actorId: string | null
  reason: string | null
}

export type SprintReportCarryOver = {
  taskId: string
  title: string
  storyPoints: number | null
  decision: 'next_sprint' | 'backlog' | 'keep' | null
  streak: number
}

export type SprintReportTaskRow = {
  taskId: string
  title: string
  storyPoints: number | null
  serviceClass: ServiceClass
  status: 'delivered' | 'carry_over' | 'removed'
  addedAtISO: string | null
  closedAtISO: string | null
  cycleDays: number | null
}

export type SprintReportPayload = {
  sprint: {
    id: string
    name: string
    goal: string
    plannedStartAt: string | null
    plannedEndAt: string | null
    startedAt: string | null
    endedAt: string | null
    factDurationDays: number | null
  }
  extensions: {
    totalEndShiftDays: number
    changes: { atISO: string; days: number; reason: string | null }[]
  }
  goal: {
    achieved: boolean | null
    comment: string | null
  }
  totals: {
    startCount: number
    startSp: number
    deliveredCount: number
    deliveredSp: number
    carryOverCount: number
    carryOverSp: number
    addedAfterStartCount: number
    removedAfterStartCount: number
  }
  scopeChanges: SprintReportScopeChange[]
  carryOver: SprintReportCarryOver[]
  tasks: SprintReportTaskRow[]
  burndown: unknown | null
  forecastVsFact: {
    start: unknown | null
    close: unknown | null
  }
  appliedScenarios: {
    id: string
    name: string
    appliedAtISO: string
    appliedBy: string | null
    changesCount: number
  }[]
  flow: {
    throughputPerWeek: number | null
    cycleP50: number | null
    cycleP85: number | null
    cycleDistribution: number[]
    agingOpenAtClose: { taskId: string; title: string; ageDays: number }[]
  }
  serviceClassDistribution: { serviceClass: ServiceClass; count: number; sp: number }[]
}

export type SprintReportResponse = {
  report: {
    sprintId: string
    payload: SprintReportPayload
    generatedAt: string
    generatedBy: string | null
  }
}
