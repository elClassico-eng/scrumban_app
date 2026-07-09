import type { NetworkTaskView } from './network'

export type ScenarioChange =
  | { type: 'exclude_task'; taskId: string }
  | { type: 'reestimate_task'; taskId: string; estimateDays: number }
  | { type: 'remove_dependency'; blockerTaskId: string; blockedTaskId: string }
  | { type: 'add_dependency'; blockerTaskId: string; blockedTaskId: string }
  | { type: 'shift_deadline'; days: number }

export type ScenarioForecast = {
  horizonDays: number | null
  remainingCount: number
  edgeCount: number
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
}

export type ScenarioDelta = {
  p50Days: number
  p85Days: number
  expectedDurationDays: number
  probabilityWithinHorizon: number | null
}

export type ScenarioSimulationReport =
  | { ok: true; baseline: ScenarioForecast; scenario: ScenarioForecast; delta: ScenarioDelta }
  | { ok: false; reason: 'insufficient_data'; closedSamples: number; requiredSamples: number }

export type SprintScenario = {
  id: string
  sprintId: string
  name: string
  changes: ScenarioChange[]
  baselineResult: ScenarioForecast | null
  scenarioResult: ScenarioForecast | null
  computedAt: string | null
  createdBy: string | null
  appliedAt: string | null
  appliedBy: string | null
  createdAt: string
  updatedAt: string
}
