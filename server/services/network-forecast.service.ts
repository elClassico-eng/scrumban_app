import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  sprints,
  sprintTasks,
  taskDependencies,
  tasks,
  type SprintState,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant, type DbTransaction } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import {
  analyzeNetwork,
  buildEstimateCatalog,
  probabilityWithin,
  scaleEstimateToM,
  simulateNetwork,
  type EstimateCatalog,
  type EstimateSource,
  type NetworkAnalysis,
  type NetworkNode,
  type PertEstimate,
  type Rng,
} from '../utils/network-planning'
import { requireMinRole } from '../utils/rbac'
import { computeMonteCarlo, type MonteCarloReport } from './analytics.service'

const DAY_MS = 86_400_000
const HISTORY_LOOKBACK_DAYS = 90
export const MIN_CLOSED_SAMPLES = 5
const SIMULATION_ITERATIONS = 5000

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

export type SprintNetworkData = {
  sprint: typeof sprints.$inferSelect
  memberRows: {
    taskId: string
    title: string
    storyPoints: number | null
    estimateDays: number | null
    closedAt: Date | null
  }[]
  history: { storyPoints: number | null; cycleDays: number }[]
  remaining: {
    taskId: string
    title: string
    storyPoints: number | null
    estimateDays: number | null
    closedAt: Date | null
  }[]
  edges: { blockerTaskId: string; blockedTaskId: string }[]
}

export async function loadBoardCycleHistory(
  tx: DbTransaction,
  boardId: string,
): Promise<{ storyPoints: number | null; cycleDays: number }[]> {
  const lookbackIso = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * DAY_MS).toISOString()
  const historyRaw = await tx.execute<{ storyPoints: number | null; cycleDays: string | number }>(sql`
    WITH closed AS (
      SELECT e.task_id, MAX(e.created_at) AS closed_at
      FROM task_events e
      JOIN tasks t ON t.id = e.task_id
      WHERE e.event_type = 'task_closed'
        AND t.board_id = ${boardId}
        AND e.created_at >= ${lookbackIso}::timestamptz
      GROUP BY e.task_id
    ),
    created AS (
      SELECT DISTINCT ON (e.task_id) e.task_id, e.created_at AS first_at
      FROM task_events e
      WHERE e.event_type = 'task_created'
      ORDER BY e.task_id, e.created_at ASC
    )
    SELECT
      t.story_points AS "storyPoints",
      GREATEST(EXTRACT(EPOCH FROM (c.closed_at - COALESCE(cr.first_at, t.created_at))) / 86400, 0.01) AS "cycleDays"
    FROM closed c
    JOIN tasks t ON t.id = c.task_id
    LEFT JOIN created cr ON cr.task_id = c.task_id
  `)
  return (historyRaw as unknown as { storyPoints: number | null; cycleDays: string | number }[])
    .map(r => ({ storyPoints: r.storyPoints, cycleDays: Number(r.cycleDays) }))
}

export async function loadSprintNetworkData(
  tx: DbTransaction,
  input: { sprintId: string; boardId: string },
): Promise<SprintNetworkData> {
  const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
  if (!sprint) throw new NotFoundError('Спринт не найден')

  const memberRows = await tx
    .select({
      taskId: tasks.id,
      title: tasks.title,
      storyPoints: tasks.storyPoints,
      estimateDays: tasks.estimateDays,
      closedAt: tasks.closedAt,
    })
    .from(sprintTasks)
    .innerJoin(tasks, eq(tasks.id, sprintTasks.taskId))
    .where(eq(sprintTasks.sprintId, input.sprintId))

  const history = await loadBoardCycleHistory(tx, input.boardId)

  const remaining = memberRows.filter(r => r.closedAt === null)
  const remainingIds = remaining.map(r => r.taskId)
  const edges = remainingIds.length > 0
    ? await tx
        .select({
          blockerTaskId: taskDependencies.blockerTaskId,
          blockedTaskId: taskDependencies.blockedTaskId,
        })
        .from(taskDependencies)
        .where(and(
          inArray(taskDependencies.blockerTaskId, remainingIds),
          inArray(taskDependencies.blockedTaskId, remainingIds),
        ))
    : []

  return { sprint, memberRows, history, remaining, edges }
}

export type SprintNodes = {
  catalog: EstimateCatalog
  nodes: NetworkNode[]
  sources: Map<string, EstimateSource>
  dependsOn: Map<string, string[]>
}

export type SprintNodesInput = Pick<SprintNetworkData, 'history' | 'remaining' | 'edges'>

export function buildSprintNodes(data: SprintNodesInput): SprintNodes | null {
  if (data.history.length < MIN_CLOSED_SAMPLES) return null

  const catalog = buildEstimateCatalog(data.history)
  const dependsOn = new Map<string, string[]>()
  for (const e of data.edges) {
    dependsOn.set(e.blockedTaskId, [...(dependsOn.get(e.blockedTaskId) ?? []), e.blockerTaskId])
  }

  const sources = new Map<string, EstimateSource>()
  const nodes: NetworkNode[] = data.remaining.map((r) => {
    const resolved = catalog.estimateFor(r.storyPoints)!
    let estimate = resolved.estimate
    let source = resolved.source
    if (r.estimateDays !== null) {
      estimate = scaleEstimateToM(resolved.estimate, r.estimateDays)
      source = { kind: 'manual', sampleCount: resolved.source.sampleCount }
    }
    sources.set(r.taskId, source)
    return { id: r.taskId, estimate, dependsOn: dependsOn.get(r.taskId) ?? [] }
  })

  return { catalog, nodes, sources, dependsOn }
}

export type ForecastCore = {
  analysis: NetworkAnalysis
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

export function buildForecast(
  nodes: NetworkNode[],
  horizonDays: number | null,
  opts?: { rng?: Rng },
): ForecastCore {
  const analysis = analyzeNetwork(nodes)
  const simulation = simulateNetwork(nodes, {
    iterations: SIMULATION_ITERATIONS,
    horizonDays,
    rng: opts?.rng,
  })
  return {
    analysis,
    pert: {
      expectedDurationDays: round2(analysis.expectedDurationDays),
      sigmaDays: round2(analysis.sigmaDays),
      probabilityWithinHorizon:
        horizonDays === null ? null : probabilityWithin(analysis, horizonDays),
    },
    simulation: {
      iterations: simulation.iterations,
      p50Days: round2(simulation.p50Days),
      p85Days: round2(simulation.p85Days),
      p95Days: round2(simulation.p95Days),
      probabilityWithinHorizon: simulation.probabilityWithinHorizon,
    },
  }
}

export function buildTaskViews(
  nodes: NetworkNode[],
  analysis: NetworkAnalysis,
  meta: Map<string, { title: string; storyPoints: number | null }>,
  sources: Map<string, EstimateSource>,
): NetworkTaskView[] {
  const analyzedById = new Map(analysis.nodes.map(n => [n.id, n]))
  return nodes.map((n) => {
    const a = analyzedById.get(n.id)!
    const m = meta.get(n.id)
    return {
      taskId: n.id,
      title: m?.title ?? '',
      storyPoints: m?.storyPoints ?? null,
      estimate: n.estimate,
      estimateSource: sources.get(n.id) ?? { kind: 'board_global', sampleCount: 0 },
      expectedDays: round2(a.expectedDays),
      earlyStartDays: round2(a.earlyStart),
      earlyFinishDays: round2(a.earlyFinish),
      slackDays: round2(a.slackDays),
      critical: a.critical,
      dependsOn: [...n.dependsOn],
    }
  })
}

export async function computeSprintNetwork(input: {
  workspaceId: string
  boardId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintNetworkReport> {
  requireMinRole(input.actorRole, 'viewer')

  const data = await withTenant(input.workspaceId, tx =>
    loadSprintNetworkData(tx, { sprintId: input.sprintId, boardId: input.boardId }))

  const built = buildSprintNodes(data)
  if (!built) {
    return {
      ok: false,
      reason: 'insufficient_data',
      closedSamples: data.history.length,
      requiredSamples: MIN_CLOSED_SAMPLES,
    }
  }

  const horizonDays = computeHorizonDays(data.sprint)
  const core = buildForecast(built.nodes, horizonDays)

  const naive = horizonDays !== null && data.remaining.length > 0
    ? await computeMonteCarlo({
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        tasksRemaining: data.remaining.length,
        horizonDays: Math.max(1, Math.ceil(horizonDays)),
        actorRole: input.actorRole,
      })
    : null

  const meta = new Map(data.remaining.map(r => [r.taskId, { title: r.title, storyPoints: r.storyPoints }]))
  const taskViews = buildTaskViews(built.nodes, core.analysis, meta, built.sources)

  return {
    ok: true,
    sprintId: data.sprint.id,
    state: data.sprint.state,
    horizonDays: horizonDays === null ? null : round2(horizonDays),
    remainingCount: data.remaining.length,
    closedCount: data.memberRows.length - data.remaining.length,
    edgeCount: data.edges.length,
    closedSamples: data.history.length,
    tasks: taskViews,
    criticalPathIds: core.analysis.criticalPathIds,
    pert: core.pert,
    simulation: core.simulation,
    naive,
  }
}

export function computeHorizonDays(sprint: {
  state: SprintState
  plannedStartAt: Date | null
  plannedEndAt: Date | null
}): number | null {
  if (!sprint.plannedEndAt) return null
  const anchor = sprint.state === 'active'
    ? Date.now()
    : (sprint.plannedStartAt?.getTime() ?? Date.now())
  return Math.max(0, (sprint.plannedEndAt.getTime() - anchor) / DAY_MS)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
