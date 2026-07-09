import type { MonteCarloReport } from './analytics'
import type { SprintState } from './domain'

export type PertEstimate = {
  optimisticDays: number
  mostLikelyDays: number
  pessimisticDays: number
}

export type EstimateSource = {
  kind: 'story_points_bucket' | 'board_global' | 'manual'
  sampleCount: number
}

export type NetworkTaskView = {
  taskId: string
  title: string
  storyPoints: number | null
  estimate: PertEstimate
  estimateSource: EstimateSource
  expectedDays: number
  earlyStartDays: number
  earlyFinishDays: number
  slackDays: number
  critical: boolean
  dependsOn: string[]
}

export type SprintNetworkReport =
  | {
      ok: true
      sprintId: string
      state: SprintState
      horizonDays: number | null
      remainingCount: number
      closedCount: number
      edgeCount: number
      closedSamples: number
      tasks: NetworkTaskView[]
      criticalPathIds: string[]
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
      naive: MonteCarloReport | null
    }
  | {
      ok: false
      reason: 'insufficient_data'
      closedSamples: number
      requiredSamples: number
    }
