import { and, desc, eq } from 'drizzle-orm'
import type {
  ScenarioChange,
  ScenarioDelta,
  ScenarioForecast,
  ScenarioSimulationReport,
  SprintScenario,
} from '../../shared/types/scenario'
import {
  sprints,
  sprintScenarios,
  sprintTasks,
  taskEvents,
  tasks,
  type SprintScenarioRow,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import {
  applyChangesToNetwork,
  createSeededRng,
  detectCycle,
  scaleEstimateToM,
  type NetworkChange,
  type NetworkNode,
} from '../utils/network-planning'
import { requireMinRole, roleAtLeast } from '../utils/rbac'
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
import { addDependencyTx, removeDependencyTx } from './task-dependencies.service'

const SIMULATION_SEED = 20260709
const DAY_MS = 86_400_000

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

export function toScenarioView(row: SprintScenarioRow): SprintScenario {
  return {
    id: row.id,
    sprintId: row.sprintId,
    name: row.name,
    changes: row.changes,
    baselineResult: row.baselineResult ?? null,
    scenarioResult: row.scenarioResult ?? null,
    computedAt: row.computedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    appliedBy: row.appliedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listScenarios(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintScenario[]> {
  requireMinRole(input.actorRole, 'viewer')
  const rows = await withTenant(input.workspaceId, tx =>
    tx
      .select()
      .from(sprintScenarios)
      .where(eq(sprintScenarios.sprintId, input.sprintId))
      .orderBy(desc(sprintScenarios.createdAt)))
  return rows.map(toScenarioView)
}

export async function createScenario(input: {
  workspaceId: string
  boardId: string
  sprintId: string
  name: string
  changes: ScenarioChange[]
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintScenario> {
  requireMinRole(input.actorRole, 'member')

  const report = await simulateScenario({
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    sprintId: input.sprintId,
    changes: input.changes,
    actorRole: input.actorRole,
  })

  const [row] = await withTenant(input.workspaceId, tx =>
    tx
      .insert(sprintScenarios)
      .values({
        workspaceId: input.workspaceId,
        sprintId: input.sprintId,
        name: input.name,
        changes: input.changes,
        baselineResult: report.ok ? report.baseline : null,
        scenarioResult: report.ok ? report.scenario : null,
        computedAt: new Date(),
        createdBy: input.actorId,
      })
      .returning())
  return toScenarioView(row!)
}

export async function updateScenario(input: {
  workspaceId: string
  boardId: string
  sprintId: string
  scenarioId: string
  patch: { name?: string; changes?: ScenarioChange[] }
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintScenario> {
  requireMinRole(input.actorRole, 'member')

  const existing = await getScenarioOrThrow(input.workspaceId, input.sprintId, input.scenarioId)
  assertCanManage(existing, input.actorId, input.actorRole)
  if (existing.appliedAt) {
    throw new ConflictError('Применённый сценарий нельзя редактировать')
  }

  const set: Partial<typeof sprintScenarios.$inferInsert> = { updatedAt: new Date() }
  if (input.patch.name !== undefined) set.name = input.patch.name
  if (input.patch.changes !== undefined) {
    const report = await simulateScenario({
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      sprintId: input.sprintId,
      changes: input.patch.changes,
      actorRole: input.actorRole,
    })
    set.changes = input.patch.changes
    set.baselineResult = report.ok ? report.baseline : null
    set.scenarioResult = report.ok ? report.scenario : null
    set.computedAt = new Date()
  }

  const [row] = await withTenant(input.workspaceId, tx =>
    tx
      .update(sprintScenarios)
      .set(set)
      .where(and(
        eq(sprintScenarios.id, input.scenarioId),
        eq(sprintScenarios.sprintId, input.sprintId),
      ))
      .returning())
  if (!row) throw new NotFoundError('Сценарий не найден')
  return toScenarioView(row)
}

export async function removeScenario(input: {
  workspaceId: string
  sprintId: string
  scenarioId: string
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')
  const existing = await getScenarioOrThrow(input.workspaceId, input.sprintId, input.scenarioId)
  assertCanManage(existing, input.actorId, input.actorRole)

  await withTenant(input.workspaceId, tx =>
    tx
      .delete(sprintScenarios)
      .where(and(
        eq(sprintScenarios.id, input.scenarioId),
        eq(sprintScenarios.sprintId, input.sprintId),
      )))
}

async function getScenarioOrThrow(
  workspaceId: string,
  sprintId: string,
  scenarioId: string,
): Promise<SprintScenarioRow> {
  const [row] = await withTenant(workspaceId, tx =>
    tx
      .select()
      .from(sprintScenarios)
      .where(and(
        eq(sprintScenarios.id, scenarioId),
        eq(sprintScenarios.sprintId, sprintId),
      )))
  if (!row) throw new NotFoundError('Сценарий не найден')
  return row
}

function assertCanManage(
  row: SprintScenarioRow,
  actorId: string,
  actorRole: WorkspaceMemberRole,
): void {
  if (roleAtLeast(actorRole, 'admin')) return
  if (row.createdBy !== actorId) {
    throw new ForbiddenError('Изменять можно только свой сценарий')
  }
}

export async function applyScenario(input: {
  workspaceId: string
  boardId: string
  sprintId: string
  scenarioId: string
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintScenario> {
  requireMinRole(input.actorRole, 'scrum_master')

  const row = await withTenant(input.workspaceId, async (tx) => {
    const [scenario] = await tx
      .select()
      .from(sprintScenarios)
      .where(and(
        eq(sprintScenarios.id, input.scenarioId),
        eq(sprintScenarios.sprintId, input.sprintId),
      ))
      .for('update')
    if (!scenario) throw new NotFoundError('Сценарий не найден')
    if (scenario.appliedAt) throw new ConflictError('Сценарий уже применён')

    const [sprint] = await tx
      .select()
      .from(sprints)
      .where(eq(sprints.id, input.sprintId))
      .for('update')
    if (!sprint) throw new NotFoundError('Спринт не найден')
    if (sprint.state === 'closed') throw new ConflictError('Спринт закрыт')

    for (const change of scenario.changes) {
      switch (change.type) {
        case 'exclude_task': {
          const res = await tx
            .delete(sprintTasks)
            .where(and(
              eq(sprintTasks.sprintId, input.sprintId),
              eq(sprintTasks.taskId, change.taskId),
            ))
          if ((res.count ?? 0) === 0) {
            throw new ConflictError('Сценарий устарел: задача уже не в спринте')
          }
          await tx.insert(taskEvents).values({
            workspaceId: input.workspaceId,
            taskId: change.taskId,
            eventType: 'task_removed_from_sprint',
            actorId: input.actorId,
            payload: { sprintId: input.sprintId, scenarioId: scenario.id, reason: 'scenario_exclude' },
          })
          break
        }
        case 'reestimate_task': {
          const [member] = await tx
            .select({ taskId: sprintTasks.taskId })
            .from(sprintTasks)
            .where(and(
              eq(sprintTasks.sprintId, input.sprintId),
              eq(sprintTasks.taskId, change.taskId),
            ))
          if (!member) {
            throw new ConflictError('Сценарий устарел: задача уже не в спринте')
          }
          const updated = await tx
            .update(tasks)
            .set({ estimateDays: change.estimateDays, updatedAt: new Date() })
            .where(eq(tasks.id, change.taskId))
          if ((updated.count ?? 0) === 0) {
            throw new ConflictError('Сценарий устарел: задача не найдена')
          }
          await tx.insert(taskEvents).values({
            workspaceId: input.workspaceId,
            taskId: change.taskId,
            eventType: 'task_updated',
            actorId: input.actorId,
            payload: { scenarioId: scenario.id, action: 'scenario_reestimate', estimateDays: change.estimateDays },
          })
          break
        }
        case 'remove_dependency': {
          try {
            await removeDependencyTx(tx, {
              blockerTaskId: change.blockerTaskId,
              blockedTaskId: change.blockedTaskId,
            })
          }
          catch (err) {
            if (err instanceof NotFoundError) {
              throw new ConflictError('Сценарий устарел: зависимость уже удалена')
            }
            throw err
          }
          break
        }
        case 'add_dependency': {
          await addDependencyTx(tx, {
            workspaceId: input.workspaceId,
            blockerTaskId: change.blockerTaskId,
            blockedTaskId: change.blockedTaskId,
            actorId: input.actorId,
          })
          break
        }
        case 'shift_deadline': {
          if (!sprint.plannedEndAt) {
            throw new ConflictError('У спринта нет планового дедлайна')
          }
          await tx
            .update(sprints)
            .set({
              plannedEndAt: new Date(sprint.plannedEndAt.getTime() + change.days * DAY_MS),
              updatedAt: new Date(),
            })
            .where(eq(sprints.id, input.sprintId))
          break
        }
      }
    }

    const [updated] = await tx
      .update(sprintScenarios)
      .set({ appliedAt: new Date(), appliedBy: input.actorId, updatedAt: new Date() })
      .where(eq(sprintScenarios.id, input.scenarioId))
      .returning()
    return updated!
  })

  publishBoardEvent({
    type: 'task.updated',
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    payload: { scenarioApplied: row.id },
  })
  return toScenarioView(row)
}
