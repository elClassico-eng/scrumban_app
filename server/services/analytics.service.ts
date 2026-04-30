// AnalyticsService: read-only flow metrics computed from task_events.
//
// Phase 3 ships two basic metrics (throughput, cycle time). CFD,
// Monte Carlo forecast and Little's Law recommendations follow in
// Step 17 — they all draw from the same task_events log so adding
// them later is purely a matter of adding new SELECT queries.
//
// Min-data thresholds: with very few closed tasks the percentiles are
// statistical noise. The percentile fields are returned as null when
// there are fewer than 5 samples — analytics-design.md calls this the
// "honesty over hype" rule.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import {
  taskEvents,
  tasks,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { requireMinRole } from '../utils/rbac'

export type ThroughputPeriod = 'day' | 'week'

export interface ThroughputBucket {
  // ISO date (start of day or start of week). Pure UTC, no TZ wobble.
  bucket: string
  // Number of task_closed events that fell inside this bucket.
  count: number
}

export async function computeThroughput(input: {
  workspaceId: string
  boardId: string
  period: ThroughputPeriod
  from: Date
  to: Date
  actorRole: WorkspaceMemberRole
}): Promise<ThroughputBucket[]> {
  requireMinRole(input.actorRole, 'viewer')

  // date_trunc's first arg cannot be a placeholder; we validate the input
  // via the type union, so injecting via sql.raw is safe.
  const periodLit = sql.raw(`'${input.period}'`)

  return withTenant(input.workspaceId, async (tx) => {
    const rows = await tx
      .select({
        bucket: sql<string>`date_trunc(${periodLit}, ${taskEvents.createdAt})`.as('bucket'),
        count: sql<number>`count(*)::int`,
      })
      .from(taskEvents)
      .innerJoin(tasks, eq(tasks.id, taskEvents.taskId))
      .where(
        and(
          eq(taskEvents.eventType, 'task_closed'),
          eq(tasks.boardId, input.boardId),
          gte(taskEvents.createdAt, input.from),
          lte(taskEvents.createdAt, input.to),
        ),
      )
      .groupBy(sql`bucket`)
      .orderBy(sql`bucket`)

    return rows.map((r) => ({
      bucket: new Date(r.bucket).toISOString(),
      count: Number(r.count),
    }))
  })
}

export interface CycleTimeStats {
  count: number
  // Hours from the task's first task_created event to its task_closed
  // event. Null when fewer than 5 samples (min-data threshold).
  meanHours: number | null
  p50Hours: number | null
  p85Hours: number | null
  p95Hours: number | null
}

export interface CycleTimeReport {
  samples: { taskId: string; cycleHours: number; closedAt: string }[]
  stats: CycleTimeStats
}

const MIN_SAMPLES_FOR_PERCENTILES = 5

export async function computeCycleTime(input: {
  workspaceId: string
  boardId: string
  from: Date
  to: Date
  actorRole: WorkspaceMemberRole
}): Promise<CycleTimeReport> {
  requireMinRole(input.actorRole, 'viewer')

  // For each task_closed event in window, look up the first task_created
  // event for that task and take the time delta. If a task has no
  // task_created (legacy data, shouldn't happen in new code), fall back
  // to tasks.created_at.
  //
  // db.execute(sql`...`) doesn't bind JS Date instances directly; convert
  // to ISO strings so postgres-js sends them as text and PostgreSQL
  // casts them on the receiving end.
  const fromIso = input.from.toISOString()
  const toIso = input.to.toISOString()
  const samples = await withTenant(input.workspaceId, async (tx) => {
    return tx.execute<{
      taskId: string
      cycleHours: string // numeric → string in postgres-js by default
      closedAt: Date
    }>(sql`
      WITH closed AS (
        SELECT e.task_id, e.created_at AS closed_at
        FROM task_events e
        JOIN tasks t ON t.id = e.task_id
        WHERE e.event_type = 'task_closed'
          AND t.board_id = ${input.boardId}
          AND e.created_at >= ${fromIso}::timestamptz
          AND e.created_at <= ${toIso}::timestamptz
      ),
      created AS (
        SELECT DISTINCT ON (e.task_id) e.task_id, e.created_at AS first_at
        FROM task_events e
        WHERE e.event_type = 'task_created'
        ORDER BY e.task_id, e.created_at ASC
      )
      SELECT
        c.task_id            AS "taskId",
        EXTRACT(EPOCH FROM (c.closed_at - COALESCE(cr.first_at, t.created_at))) / 3600 AS "cycleHours",
        c.closed_at          AS "closedAt"
      FROM closed c
      JOIN tasks t ON t.id = c.task_id
      LEFT JOIN created cr ON cr.task_id = c.task_id
      WHERE c.closed_at >= COALESCE(cr.first_at, t.created_at)
      ORDER BY c.closed_at DESC
    `)
  })

  const sampleArray = (samples as unknown as Array<{
    taskId: string
    cycleHours: string | number
    closedAt: Date | string
  }>).map((r) => ({
    taskId: r.taskId,
    cycleHours: Number(r.cycleHours),
    closedAt: typeof r.closedAt === 'string' ? r.closedAt : r.closedAt.toISOString(),
  }))

  const stats = computeCycleTimeStats(sampleArray.map((s) => s.cycleHours))
  return { samples: sampleArray, stats }
}

function computeCycleTimeStats(values: number[]): CycleTimeStats {
  const sorted = [...values].sort((a, b) => a - b)
  const count = sorted.length
  const enoughForStats = count >= MIN_SAMPLES_FOR_PERCENTILES
  return {
    count,
    meanHours: count === 0 ? null : sorted.reduce((a, b) => a + b, 0) / count,
    p50Hours: enoughForStats ? percentile(sorted, 50) : null,
    p85Hours: enoughForStats ? percentile(sorted, 85) : null,
    p95Hours: enoughForStats ? percentile(sorted, 95) : null,
  }
}

// Linear-interpolation percentile (a.k.a. "type 7" quantile, the default
// in NumPy / R / Excel). Sorted ascending, p in 0..100.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!
  const idx = ((sorted.length - 1) * p) / 100
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo)
}
