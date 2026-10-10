import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import type { BoardForecastJournal, CalibrationRow, ForecastCalibrationReport, ForecastSnapshotPayload, SprintResolution } from '#shared/types/forecast'
import { reliabilityFor, resolveOutcome } from '../utils/forecast-outcome'
import {
  forecastSnapshots,
  sprints,
  sprintTasks,
  tasks,
  workspaces,
  type ForecastSnapshot,
  type Sprint,
  type ForecastTrigger,
  type WorkspaceMemberRole,
} from '../db/schema'
import { useDB, withTenant } from '../utils/db'
import { shouldSkipDailySnapshot } from '../utils/forecast-dedupe'
import { requireMinRole } from '../utils/rbac'
import { computeSprintNetwork } from './network-forecast.service'

export async function takeSprintSnapshot(input: {
  workspaceId: string
  boardId: string
  sprintId: string
  trigger: ForecastTrigger
  actorRole: WorkspaceMemberRole
  resolution?: SprintResolution
}): Promise<ForecastSnapshot | null> {
  requireMinRole(input.actorRole, 'viewer')

  if (input.trigger === 'daily') {
    const last = await withTenant(input.workspaceId, tx =>
      tx
        .select({ takenAt: forecastSnapshots.takenAt })
        .from(forecastSnapshots)
        .where(and(
          eq(forecastSnapshots.sprintId, input.sprintId),
          eq(forecastSnapshots.trigger, 'daily'),
        ))
        .orderBy(desc(forecastSnapshots.takenAt))
        .limit(1),
    )
    if (shouldSkipDailySnapshot(last[0]?.takenAt ?? null, new Date())) return null
  }

  const report = await computeSprintNetwork(input)
  if (!report.ok) return null

  return withTenant(input.workspaceId, async (tx) => {
    const members = await tx
      .select({ storyPoints: tasks.storyPoints })
      .from(sprintTasks)
      .innerJoin(tasks, eq(tasks.id, sprintTasks.taskId))
      .where(eq(sprintTasks.sprintId, input.sprintId))

    const committedSp = members.reduce((acc, m) => acc + (m.storyPoints ?? 0), 0)

    const payload: ForecastSnapshotPayload = {
      pert: report.pert,
      simulation: report.simulation,
      naiveProbability: report.naive && report.naive.ok ? report.naive.probability : null,
      remainingCount: report.remainingCount,
      committedSp,
      horizonDays: report.horizonDays,
      closedSamples: report.closedSamples,
      edgeCount: report.edgeCount,
    }

    if (input.trigger === 'sprint_close' && input.resolution) payload.resolution = input.resolution

    const [row] = await tx
      .insert(forecastSnapshots)
      .values({
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        sprintId: input.sprintId,
        trigger: input.trigger,
        payload,
      })
      .returning()
    return row!
  })
}

export async function listSprintSnapshots(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<ForecastSnapshot[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, tx =>
    tx
      .select()
      .from(forecastSnapshots)
      .where(eq(forecastSnapshots.sprintId, input.sprintId))
      .orderBy(forecastSnapshots.takenAt),
  )
}

export async function computeBoardForecastCalibration(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<ForecastCalibrationReport> {
  requireMinRole(input.actorRole, 'viewer')

  const rows = await withTenant(input.workspaceId, async (tx) => {
    const closed = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, input.boardId), eq(sprints.state, 'closed')))
    if (closed.length === 0) return []
    const anchors = await tx
      .select()
      .from(forecastSnapshots)
      .where(and(
        inArray(forecastSnapshots.sprintId, closed.map(s => s.id)),
        inArray(forecastSnapshots.trigger, ['sprint_start', 'sprint_close']),
      ))
      .orderBy(forecastSnapshots.takenAt)
    return closed.map(s => buildCalibrationRow(s, anchors.filter(a => a.sprintId === s.id)))
      .filter((r): r is CalibrationRow => r !== null)
  })

  rows.sort((a, b) => a.endedAt.localeCompare(b.endedAt))
  return summarizeCalibration(rows)
}

export async function listBoardForecastJournal(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<BoardForecastJournal> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const list = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, input.boardId), inArray(sprints.state, ['active', 'closed']), isNotNull(sprints.startedAt)))
    const snaps = await tx
      .select()
      .from(forecastSnapshots)
      .where(eq(forecastSnapshots.boardId, input.boardId))
      .orderBy(forecastSnapshots.takenAt)
    const ts = (d: Date | null) => d?.getTime() ?? 0
    list.sort((a, b) => {
      if (a.state !== b.state) return a.state === 'active' ? -1 : 1
      return a.state === 'active' ? ts(b.startedAt) - ts(a.startedAt) : ts(b.endedAt) - ts(a.endedAt)
    })
    return {
      sprints: list.map((s) => {
        const own = snaps.filter((x) => x.sprintId === s.id)
        return {
          sprint: {
            id: s.id,
            name: s.name,
            state: s.state,
            startedAt: s.startedAt?.toISOString() ?? null,
            endedAt: s.endedAt?.toISOString() ?? null,
          },
          outcome: s.state === 'closed' ? buildCalibrationRow(s, own) : null,
          snapshots: own.map((x) => ({
            id: x.id,
            sprintId: x.sprintId,
            trigger: x.trigger,
            takenAt: x.takenAt.toISOString(),
            payload: x.payload as ForecastSnapshotPayload,
          })),
        }
      }),
    }
  })
}

export function buildCalibrationRow(sprint: Sprint, anchors: ForecastSnapshot[]): CalibrationRow | null {
  if (!sprint.startedAt || !sprint.endedAt) return null
  const start = anchors.find(a => a.trigger === 'sprint_start')?.payload as ForecastSnapshotPayload | undefined
  const close = anchors.find(a => a.trigger === 'sprint_close')?.payload as ForecastSnapshotPayload | undefined
  const outcome = resolveOutcome({ startedAt: sprint.startedAt, start: start ?? null, close: close ?? null })
  const res = close?.resolution
  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    startedAt: sprint.startedAt.toISOString(),
    endedAt: sprint.endedAt.toISOString(),
    p50Days: start?.simulation.p50Days ?? null,
    p85Days: start?.simulation.p85Days ?? null,
    p95Days: start?.simulation.p95Days ?? null,
    doneCount: res?.doneCount ?? null,
    totalCount: res?.totalCount ?? null,
    carriedCount: res?.carriedCount ?? null,
    doneSp: res?.doneSp ?? null,
    totalSp: res?.totalSp ?? null,
    ...outcome,
  }
}

export function summarizeCalibration(rows: CalibrationRow[]): ForecastCalibrationReport {
  const scoredRows = rows.filter(r => r.outcome !== 'unknown')
  const scored = scoredRows.length
  return {
    rows,
    scored,
    unknown: rows.length - scored,
    p50HitRate: scored === 0 ? null : scoredRows.filter(r => r.p50Hit).length / scored,
    p85HitRate: scored === 0 ? null : scoredRows.filter(r => r.p85Hit).length / scored,
    reliability: reliabilityFor(scored),
  }
}

export async function runDailyForecastSnapshots(): Promise<{ sprintsChecked: number, snapshotsTaken: number }> {
  const wsList = await useDB().select({ id: workspaces.id }).from(workspaces)
  let sprintsChecked = 0
  let snapshotsTaken = 0
  for (const ws of wsList) {
    const active = await withTenant(ws.id, tx =>
      tx
        .select({ id: sprints.id, boardId: sprints.boardId })
        .from(sprints)
        .where(eq(sprints.state, 'active')),
    )
    for (const s of active) {
      sprintsChecked += 1
      try {
        const row = await takeSprintSnapshot({
          workspaceId: ws.id,
          boardId: s.boardId,
          sprintId: s.id,
          trigger: 'daily',
          actorRole: 'owner',
        })
        if (row) snapshotsTaken += 1
      } catch (err) {
        console.error('daily forecast snapshot failed', { workspaceId: ws.id, sprintId: s.id }, err)
      }
    }
  }
  return { sprintsChecked, snapshotsTaken }
}
