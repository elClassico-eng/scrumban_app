import { and, inArray, isNull } from 'drizzle-orm'
import type { SprintPreviewReport, SprintPreviewRisk } from '../../shared/types/sprint'
import { taskDependencies, tasks, type WorkspaceMemberRole } from '../db/schema'
import { withTenant } from '../utils/db'
import { ValidationError } from '../utils/errors'
import { createSeededRng } from '../utils/network-planning'
import { requireMinRole } from '../utils/rbac'
import {
  buildForecast,
  buildSprintNodes,
  buildTaskViews,
  loadBoardCycleHistory,
  MIN_CLOSED_SAMPLES,
  type SprintNodesInput,
} from './network-forecast.service'

const DAY_MS = 86_400_000
const PREVIEW_SEED = 20260712

export async function computeSprintPreview(input: {
  workspaceId: string
  boardId: string
  taskIds: string[]
  plannedStartAt: Date | null
  plannedEndAt: Date | null
  actorRole: WorkspaceMemberRole
}): Promise<SprintPreviewReport> {
  requireMinRole(input.actorRole, 'scrum_master')

  const uniqueIds = [...new Set(input.taskIds)]
  if (uniqueIds.length === 0) {
    throw new ValidationError('Выберите хотя бы одну задачу для прогноза')
  }

  const data = await withTenant(input.workspaceId, async (tx) => {
    const rows = await tx
      .select({
        taskId: tasks.id,
        title: tasks.title,
        storyPoints: tasks.storyPoints,
        estimateDays: tasks.estimateDays,
        closedAt: tasks.closedAt,
        boardId: tasks.boardId,
      })
      .from(tasks)
      .where(inArray(tasks.id, uniqueIds))

    if (rows.length !== uniqueIds.length) {
      throw new ValidationError('Некоторые задачи не найдены')
    }
    const foreign = rows.filter(r => r.boardId !== input.boardId)
    if (foreign.length > 0) {
      throw new ValidationError('Все задачи должны принадлежать этой доске')
    }
    const closed = rows.filter(r => r.closedAt !== null)
    if (closed.length > 0) {
      throw new ValidationError(
        `Закрытые задачи нельзя брать в спринт: ${closed.map(r => `«${r.title}»`).join(', ')}`,
      )
    }

    const history = await loadBoardCycleHistory(tx, input.boardId)

    const edges = await tx
      .select({
        blockerTaskId: taskDependencies.blockerTaskId,
        blockedTaskId: taskDependencies.blockedTaskId,
      })
      .from(taskDependencies)
      .where(inArray(taskDependencies.blockedTaskId, uniqueIds))

    const idSet = new Set(uniqueIds)
    const externalBlockerIds = [
      ...new Set(edges.filter(e => !idSet.has(e.blockerTaskId)).map(e => e.blockerTaskId)),
    ]
    const openExternalBlockers = externalBlockerIds.length > 0
      ? await tx
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(and(inArray(tasks.id, externalBlockerIds), isNull(tasks.closedAt)))
      : []

    return { rows, history, edges, openExternalBlockers }
  })

  const risks: SprintPreviewRisk[] = []
  const unestimated = data.rows.filter(r => r.storyPoints === null && r.estimateDays === null)
  if (unestimated.length > 0) {
    risks.push({ type: 'unestimated', taskIds: unestimated.map(r => r.taskId) })
  }
  const openBlockerById = new Map(data.openExternalBlockers.map(b => [b.id, b.title]))
  for (const e of data.edges) {
    const blockerTitle = openBlockerById.get(e.blockerTaskId)
    if (blockerTitle !== undefined) {
      risks.push({
        type: 'external_dependency',
        taskId: e.blockedTaskId,
        blockerTaskId: e.blockerTaskId,
        blockerTitle,
      })
    }
  }

  const idSet = new Set(uniqueIds)
  const internalEdges = data.edges.filter(e => idSet.has(e.blockerTaskId))
  const networkData: SprintNodesInput = {
    history: data.history,
    remaining: data.rows,
    edges: internalEdges,
  }

  const built = buildSprintNodes(networkData)
  if (!built) {
    return {
      ok: false,
      reason: 'insufficient_data',
      closedSamples: data.history.length,
      requiredSamples: MIN_CLOSED_SAMPLES,
      risks,
    }
  }

  const horizonDays = computePreviewHorizon(input.plannedStartAt, input.plannedEndAt)
  const core = buildForecast(built.nodes, horizonDays, { rng: createSeededRng(PREVIEW_SEED) })
  const meta = new Map(data.rows.map(r => [r.taskId, { title: r.title, storyPoints: r.storyPoints }]))

  return {
    ok: true,
    horizonDays: horizonDays === null ? null : Math.round(horizonDays * 100) / 100,
    taskCount: data.rows.length,
    edgeCount: internalEdges.length,
    totalStoryPoints: data.rows.reduce((acc, r) => acc + (r.storyPoints ?? 0), 0),
    tasks: buildTaskViews(built.nodes, core.analysis, meta, built.sources),
    criticalPathIds: core.analysis.criticalPathIds,
    pert: core.pert,
    simulation: core.simulation,
    risks,
  }
}

function computePreviewHorizon(start: Date | null, end: Date | null): number | null {
  if (!end) return null
  const anchor = start ? Math.max(start.getTime(), Date.now()) : Date.now()
  return Math.max(0, (end.getTime() - anchor) / DAY_MS)
}
