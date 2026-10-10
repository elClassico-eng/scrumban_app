export type ForecastTrigger = 'sprint_start' | 'sprint_close' | 'daily'

export type ForecastSnapshotPayload = {
  pert: {
    expectedDurationDays: number
    sigmaDays: number
    probabilityWithinHorizon: number | null
  }
  simulation: {
    iterations: number
    p50Days: number
    p85Days: number
    p95Days: number
    probabilityWithinHorizon: number | null
  }
  naiveProbability: number | null
  remainingCount: number
  committedSp: number
  horizonDays: number | null
  closedSamples: number
  edgeCount: number
  resolution?: SprintResolution
}

export type SprintResolution = {
  totalCount: number
  doneCount: number
  totalSp: number
  doneSp: number
  lastDoneAt?: string | null
  carriedCount?: number
}

export type ForecastSnapshotView = {
  id: string
  sprintId: string
  trigger: ForecastTrigger
  takenAt: string
  payload: ForecastSnapshotPayload
}

export type SprintForecastHistoryResponse = {
  snapshots: ForecastSnapshotView[]
}

export type SprintOutcome = 'hit' | 'miss' | 'carryover' | 'unknown'

export type SprintOutcomeResult = {
  outcome: SprintOutcome
  actualDays: number | null
  p50Hit: boolean | null
  p85Hit: boolean | null
}

export type CalibrationReliability = 'insufficient' | 'low' | 'ok'

export type CalibrationRow = SprintOutcomeResult & {
  sprintId: string
  sprintName: string
  startedAt: string
  endedAt: string
  p50Days: number | null
  p85Days: number | null
  p95Days: number | null
  doneCount: number | null
  totalCount: number | null
  carriedCount: number | null
  doneSp: number | null
  totalSp: number | null
}

export type ForecastCalibrationReport = {
  rows: CalibrationRow[]
  scored: number
  unknown: number
  p50HitRate: number | null
  p85HitRate: number | null
  reliability: CalibrationReliability
}

export type ForecastCalibrationResponse = {
  report: ForecastCalibrationReport
}

export type BoardForecastJournal = {
  sprints: {
    sprint: { id: string; name: string; state: string; startedAt: string | null; endedAt: string | null }
    outcome: CalibrationRow | null
    snapshots: ForecastSnapshotView[]
  }[]
}
