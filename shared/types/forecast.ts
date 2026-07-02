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
  resolution?: {
    totalCount: number
    doneCount: number
    totalSp: number
    doneSp: number
  }
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

export type ForecastAccuracyRow = {
  sprintId: string
  sprintName: string
  endedAt: string
  p50Days: number
  p85Days: number
  actualDays: number
  p50Hit: boolean
  p85Hit: boolean
}

export type ForecastAccuracyReport = {
  rows: ForecastAccuracyRow[]
  p50HitCount: number
  p85HitCount: number
  total: number
}

export type ForecastAccuracyResponse = {
  report: ForecastAccuracyReport
}
