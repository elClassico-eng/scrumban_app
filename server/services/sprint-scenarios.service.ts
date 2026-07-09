import type {
  ScenarioChange,
  ScenarioDelta,
  ScenarioForecast,
  ScenarioSimulationReport,
} from '../../shared/types/scenario'
import { type WorkspaceMemberRole } from '../db/schema'
import { withTenant } from '../utils/db'
import { ValidationError } from '../utils/errors'
import {
  applyChangesToNetwork,
  createSeededRng,
  detectCycle,
  scaleEstimateToM,
  type NetworkChange,
  type NetworkNode,
} from '../utils/network-planning'
import { requireMinRole } from '../utils/rbac'
import {
  buildForecast,
  buildSprintNodes,
  buildTaskViews,
  computeHorizonDays,
  loadSprintNetworkData,
  MIN_CLOSED_SAMPLES,
  type SprintNetworkData,
  type SprintNodes,
} from './network-forecast.service'

const SIMULATION_SEED = 20260709

export async function simulateScenario(input: {
  workspaceId: string
  boardId: string
  sprintId: string
  changes: ScenarioChange[]
  actorRole: WorkspaceMemberRole
}): Promise<ScenarioSimulationReport> {
  requireMinRole(input.actorRole, 'member')

  const data = await withTenant(input.workspaceId, tx =>
    loadSprintNetworkData(tx, { sprintId: input.sprintId, boardId: input.boardId }))

  return computeScenarioReport(data, input.changes)
}

export function computeScenarioReport(
  data: SprintNetworkData,
  changes: ScenarioChange[],
): ScenarioSimulationReport {
  const built = buildSprintNodes(data)
  if (!built) {
    return {
      ok: false,
      reason: 'insufficient_data',
      closedSamples: data.history.length,
      requiredSamples: MIN_CLOSED_SAMPLES,
    }
  }

  const { networkChanges, deadlineShiftDays } = translateChanges(data, built, changes)

  const scenarioNodes = applyChangesToNetwork(built.nodes, networkChanges)
  if (detectCycle(scenarioNodes)) {
    throw new ValidationError('Цикл в графе зависимостей')
  }

  const baseHorizon = computeHorizonDays(data.sprint)
  const scenarioHorizon = baseHorizon === null
    ? null
    : Math.max(0, baseHorizon + deadlineShiftDays)

  const baseline = toForecast(data, built, built.nodes, baseHorizon)
  const scenario = toForecast(data, built, scenarioNodes, scenarioHorizon)

  return { ok: true, baseline, scenario, delta: computeDelta(baseline, scenario) }
}

function translateChanges(
  data: SprintNetworkData,
  built: SprintNodes,
  changes: ScenarioChange[],
): { networkChanges: NetworkChange[]; deadlineShiftDays: number } {
  const remainingIds = new Set(built.nodes.map(n => n.id))
  const networkChanges: NetworkChange[] = []
  let deadlineShiftDays = 0

  for (const c of changes) {
    if (c.type === 'shift_deadline') {
      deadlineShiftDays = c.days
      continue
    }
    if (c.type === 'exclude_task' || c.type === 'reestimate_task') {
      if (!remainingIds.has(c.taskId)) {
        throw new ValidationError('Задача не входит в открытые задачи спринта')
      }
    }
    else if (!remainingIds.has(c.blockerTaskId) || !remainingIds.has(c.blockedTaskId)) {
      throw new ValidationError('Обе задачи зависимости должны быть открытыми задачами спринта')
    }

    if (c.type === 'exclude_task') {
      networkChanges.push({ type: 'exclude', id: c.taskId })
    }
    else if (c.type === 'reestimate_task') {
      const row = data.remaining.find(r => r.taskId === c.taskId)!
      const base = built.catalog.estimateFor(row.storyPoints)!.estimate
      networkChanges.push({
        type: 'setEstimate',
        id: c.taskId,
        estimate: scaleEstimateToM(base, c.estimateDays),
      })
    }
    else if (c.type === 'remove_dependency') {
      networkChanges.push({ type: 'removeEdge', blockerId: c.blockerTaskId, blockedId: c.blockedTaskId })
    }
    else {
      networkChanges.push({ type: 'addEdge', blockerId: c.blockerTaskId, blockedId: c.blockedTaskId })
    }
  }

  return { networkChanges, deadlineShiftDays }
}

function toForecast(
  data: SprintNetworkData,
  built: SprintNodes,
  nodes: NetworkNode[],
  horizonDays: number | null,
): ScenarioForecast {
  const core = buildForecast(nodes, horizonDays, { rng: createSeededRng(SIMULATION_SEED) })
  const meta = new Map(data.remaining.map(r => [r.taskId, { title: r.title, storyPoints: r.storyPoints }]))
  const tasks = buildTaskViews(nodes, core.analysis, meta, built.sources)
  const edgeCount = nodes.reduce((acc, n) => acc + n.dependsOn.length, 0)
  return {
    horizonDays: horizonDays === null ? null : Math.round(horizonDays * 100) / 100,
    remainingCount: nodes.length,
    edgeCount,
    tasks,
    criticalPathIds: core.analysis.criticalPathIds,
    pert: core.pert,
    simulation: core.simulation,
  }
}

function computeDelta(baseline: ScenarioForecast, scenario: ScenarioForecast): ScenarioDelta {
  return {
    p50Days: round2(baseline.simulation.p50Days - scenario.simulation.p50Days),
    p85Days: round2(baseline.simulation.p85Days - scenario.simulation.p85Days),
    expectedDurationDays: round2(baseline.pert.expectedDurationDays - scenario.pert.expectedDurationDays),
    probabilityWithinHorizon:
      baseline.simulation.probabilityWithinHorizon === null ||
      scenario.simulation.probabilityWithinHorizon === null
        ? null
        : round2(scenario.simulation.probabilityWithinHorizon - baseline.simulation.probabilityWithinHorizon),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
