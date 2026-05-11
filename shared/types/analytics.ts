export interface CfdColumn {
  id: string
  name: string
  columnRole: string
  position: number
}

export interface CfdPoint {
  date: string
  counts: Record<string, number>
}

export interface CfdReport {
  from: string
  to: string
  columns: CfdColumn[]
  points: CfdPoint[]
}

export interface CycleTimeSample {
  taskId: string
  cycleHours: number
  closedAt: string
}

export interface CycleTimeStats {
  count: number
  meanHours: number | null
  p50Hours: number | null
  p85Hours: number | null
  p95Hours: number | null
}

export interface CycleTimeReport {
  from: string
  to: string
  samples: CycleTimeSample[]
  stats: CycleTimeStats
}

export type ThroughputPeriod = 'day' | 'week'

export interface ThroughputBucket {
  bucket: string
  count: number
}

export interface ThroughputReport {
  period: ThroughputPeriod
  from: string
  to: string
  buckets: ThroughputBucket[]
}

export type MonteCarloReport =
  | {
      ok: true
      iterations: number
      sampleDays: number
      historicalDailyThroughput: number[]
      probability: number
      percentileDays: { p50: number; p85: number; p95: number }
    }
  | {
      ok: false
      reason: 'insufficient_data'
      sampleDays: number
      requiredDays: number
    }

export interface MonteCarloQuery {
  tasksRemaining: number
  horizonDays: number
  iterations?: number
}

export interface WipColumnRecommendation {
  columnId: string
  name: string
  columnRole: string
  currentWipLimit: number | null
  currentTaskCount: number
  recommendedWip: number
}

export type WipRecommendationsReport =
  | {
      ok: true
      throughputPerDay: number
      meanCycleTimeDays: number
      sampleSize: number
      columns: WipColumnRecommendation[]
    }
  | {
      ok: false
      reason: 'insufficient_data'
      sampleSize: number
      requiredSamples: number
    }