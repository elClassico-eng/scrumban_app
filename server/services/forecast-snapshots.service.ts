import { and, desc, eq } from 'drizzle-orm'
import type { ForecastAccuracyReport, ForecastAccuracyRow, ForecastSnapshotPayload } from '#shared/types/forecast'
import {
  forecastSnapshots,
  sprints,
  sprintTasks,
  tasks,
  type ForecastSnapshot,
  type ForecastTrigger,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { shouldSkipDailySnapshot } from '../utils/forecast-dedupe'
import { requireMinRole } from '../utils/rbac'
import { computeSprintNetwork } from './network-forecast.service'

export async function takeSprintSnapshot(input: {
  workspaceId: string
  boardId: string
  sprintId: string
  trigger: ForecastTrigger
  actorRole: WorkspaceMemberRole
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
      .select({ storyPoints: tasks.storyPoints, closedAt: tasks.closedAt })
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

    if (input.trigger === 'sprint_close') {
      const done = members.filter(m => m.closedAt !== null)
      payload.resolution = {
        totalCount: members.length,
        doneCount: done.length,
        totalSp: committedSp,
        doneSp: done.reduce((acc, m) => acc + (m.storyPoints ?? 0), 0),
      }
    }

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

const DAY_MS = 86_400_000

export async function computeBoardForecastAccuracy(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<ForecastAccuracyReport> {
  requireMinRole(input.actorRole, 'viewer')

  return withTenant(input.workspaceId, async (tx) => {
    const closed = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, input.boardId), eq(sprints.state, 'closed')))

    const rows: ForecastAccuracyRow[] = []
    for (const s of closed) {
      if (!s.startedAt || !s.endedAt) continue
      const [anchor] = await tx
        .select()
        .from(forecastSnapshots)
        .where(and(
          eq(forecastSnapshots.sprintId, s.id),
          eq(forecastSnapshots.trigger, 'sprint_start'),
        ))
        .orderBy(forecastSnapshots.takenAt)
        .limit(1)
      if (!anchor) continue

      const payload = anchor.payload as ForecastSnapshotPayload
      const actualDays = Math.round(((s.endedAt.getTime() - s.startedAt.getTime()) / DAY_MS) * 10) / 10
      rows.push({
        sprintId: s.id,
        sprintName: s.name,
        endedAt: s.endedAt.toISOString(),
        p50Days: payload.simulation.p50Days,
        p85Days: payload.simulation.p85Days,
        actualDays,
        p50Hit: actualDays <= payload.simulation.p50Days,
        p85Hit: actualDays <= payload.simulation.p85Days,
      })
    }

    rows.sort((a, b) => a.endedAt.localeCompare(b.endedAt))
    return {
      rows,
      p50HitCount: rows.filter(r => r.p50Hit).length,
      p85HitCount: rows.filter(r => r.p85Hit).length,
      total: rows.length,
    }
  })
}
