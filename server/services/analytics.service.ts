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

// =============================================================================
// CFD (Cumulative Flow Diagram)
// =============================================================================
//
// For each day in [from, to], counts how many tasks are in each column at
// end-of-day. Computed by replaying task_events ordered by time and tracking
// the latest known column per task; at the boundary of each day we snapshot
// the per-column counts. Tasks that have been deleted lose their events
// (FK cascade) and so are absent from the chart — deliberate simplification
// for MVP.

export interface CFDPoint {
  date: string // ISO date (UTC, start of day)
  counts: Record<string, number> // columnId → count at end of day
}

export interface CFDReport {
  columns: { id: string; name: string; columnRole: string; position: number }[]
  points: CFDPoint[]
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function computeCFD(input: {
  workspaceId: string
  boardId: string
  from: Date
  to: Date
  actorRole: WorkspaceMemberRole
}): Promise<CFDReport> {
  requireMinRole(input.actorRole, 'viewer')

  return withTenant(input.workspaceId, async (tx) => {
    // Pull all events for tasks on this board up to the end of `to`,
    // ordered chronologically. Events without a toColumnId (none today,
    // but defensive) are filtered out.
    const toIso = input.to.toISOString()
    const eventsRaw = await tx.execute<{
      taskId: string
      toColumnId: string | null
      createdAt: Date
    }>(sql`
      SELECT
        e.task_id      AS "taskId",
        e.to_column_id AS "toColumnId",
        e.created_at   AS "createdAt"
      FROM task_events e
      JOIN tasks t ON t.id = e.task_id
      WHERE t.board_id = ${input.boardId}
        AND e.created_at <= ${toIso}::timestamptz
        AND e.to_column_id IS NOT NULL
      ORDER BY e.created_at ASC, e.id ASC
    `)
    const events = eventsRaw as unknown as {
      taskId: string
      toColumnId: string
      createdAt: Date | string
    }[]

    const cols = await tx.execute<{
      id: string
      name: string
      columnRole: string
      position: number
    }>(sql`
      SELECT id, name, column_role AS "columnRole", position
      FROM board_columns
      WHERE board_id = ${input.boardId}
      ORDER BY position
    `)
    const columns = (cols as unknown as CFDReport['columns'])

    // Build day list, then sweep events in order. For each day boundary
    // (end-of-day), snapshot the per-column counts.
    const points: CFDPoint[] = []
    const taskColumn = new Map<string, string>()
    let eventIdx = 0

    const fromMidnight = startOfUTCDay(input.from)
    const toMidnight = startOfUTCDay(input.to)

    for (
      let day = fromMidnight.getTime();
      day <= toMidnight.getTime();
      day += DAY_MS
    ) {
      const endOfDay = day + DAY_MS - 1
      while (eventIdx < events.length) {
        const ev = events[eventIdx]!
        const ts = typeof ev.createdAt === 'string' ? Date.parse(ev.createdAt) : ev.createdAt.getTime()
        if (ts > endOfDay) break
        taskColumn.set(ev.taskId, ev.toColumnId)
        eventIdx++
      }

      const counts: Record<string, number> = {}
      for (const c of columns) counts[c.id] = 0
      for (const colId of taskColumn.values()) {
        if (counts[colId] !== undefined) counts[colId]++
      }
      points.push({ date: new Date(day).toISOString(), counts })
    }

    return { columns, points }
  })
}

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// =============================================================================
// Monte Carlo sprint forecast
// =============================================================================
//
// Question we're answering: given the team's historical daily throughput,
// what is the probability that they finish N tasks within H days?
//
// Method: empirical bootstrap. Sample H daily throughput values from history
// (with replacement) → sum → check ≥ N → repeat 1000+ times → fraction of
// runs that succeeded is our probability estimate.
//
// We also report percentile completion times (P50/P85/P95): for each
// simulation we record how many days it took to accumulate ≥ N tasks
// (bounded to H days).
//
// Min-data threshold: needs at least MIN_DAYS_OF_HISTORY days of
// throughput-bearing history. Below that we return insufficient_data so
// the UI doesn't show a probability number derived from noise.

export interface MonteCarloRequest {
  workspaceId: string
  boardId: string
  tasksRemaining: number
  horizonDays: number
  iterations?: number
  actorRole: WorkspaceMemberRole
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

const MIN_DAYS_OF_HISTORY = 14
const DEFAULT_ITERATIONS = 1000
const HISTORY_LOOKBACK_DAYS = 90

export async function computeMonteCarlo(input: MonteCarloRequest): Promise<MonteCarloReport> {
  requireMinRole(input.actorRole, 'viewer')
  if (input.tasksRemaining <= 0) {
    return { ok: true, iterations: 0, sampleDays: 0, historicalDailyThroughput: [], probability: 1, percentileDays: { p50: 0, p85: 0, p95: 0 } }
  }
  if (input.horizonDays <= 0) {
    return { ok: true, iterations: 0, sampleDays: 0, historicalDailyThroughput: [], probability: 0, percentileDays: { p50: 0, p85: 0, p95: 0 } }
  }
  const iterations = Math.max(1, Math.min(input.iterations ?? DEFAULT_ITERATIONS, 10_000))

  const now = new Date()
  const lookbackStart = new Date(now.getTime() - HISTORY_LOOKBACK_DAYS * DAY_MS)
  const buckets = await computeThroughput({
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    period: 'day',
    from: lookbackStart,
    to: now,
    actorRole: input.actorRole,
  })

  // computeThroughput only returns days with at least one closed task.
  // For Monte Carlo we want a vector that includes zero-throughput days
  // (those are equally informative: "they sometimes ship nothing").
  const dailyThroughput = expandWithZeros(buckets, lookbackStart, now)
  const sampleDays = dailyThroughput.length
  // expandWithZeros always returns a vector spanning [from, to], so
  // `sampleDays` only fails for absurd inputs. The real "do we have
  // enough signal?" check is whether the team has actually closed any
  // tasks in window; without that the simulation just returns 0% and
  // the user gets a meaningless number.
  const totalClosed = dailyThroughput.reduce((sum, n) => sum + n, 0)
  if (totalClosed === 0 || sampleDays < MIN_DAYS_OF_HISTORY) {
    return {
      ok: false,
      reason: 'insufficient_data',
      sampleDays,
      requiredDays: MIN_DAYS_OF_HISTORY,
    }
  }

  let successes = 0
  const completionDays: number[] = []
  for (let i = 0; i < iterations; i++) {
    let total = 0
    let day = 0
    for (; day < input.horizonDays; day++) {
      total += dailyThroughput[Math.floor(Math.random() * dailyThroughput.length)]!
      if (total >= input.tasksRemaining) break
    }
    if (total >= input.tasksRemaining) {
      successes++
      completionDays.push(day + 1) // 1-indexed: "took N days"
    } else {
      completionDays.push(input.horizonDays + 1) // didn't finish in time
    }
  }

  const sortedDays = [...completionDays].sort((a, b) => a - b)
  return {
    ok: true,
    iterations,
    sampleDays,
    historicalDailyThroughput: dailyThroughput,
    probability: successes / iterations,
    percentileDays: {
      p50: percentile(sortedDays, 50),
      p85: percentile(sortedDays, 85),
      p95: percentile(sortedDays, 95),
    },
  }
}

function expandWithZeros(buckets: ThroughputBucket[], from: Date, to: Date): number[] {
  const byDay = new Map<number, number>()
  for (const b of buckets) {
    byDay.set(startOfUTCDay(new Date(b.bucket)).getTime(), b.count)
  }
  const out: number[] = []
  for (
    let d = startOfUTCDay(from).getTime();
    d <= startOfUTCDay(to).getTime();
    d += DAY_MS
  ) {
    out.push(byDay.get(d) ?? 0)
  }
  return out
}

// =============================================================================
// Little's Law WIP recommendations
// =============================================================================
//
// L = λ × W   (WIP = throughput × cycle time)
//
// We compute board-wide daily throughput (closed tasks/day, last 30 days)
// and board-wide cycle time (mean hours from task_created to task_closed,
// last 30 days). The implied "balanced WIP" for the whole board is
// λ × W_in_days. We split that proportionally across the columns whose
// column_role is in {in_progress, review} — those are where WIP limits
// actually matter; backlog/done don't bottleneck flow.
//
// The recommendation is descriptive ("data suggests N") not prescriptive;
// the UI shows it next to the configured wip_limit so the SM can decide.

export type WipRecommendation =
  | {
      ok: true
      throughputPerDay: number
      meanCycleTimeDays: number
      sampleSize: number
      // One row per "active" column (column_role ∈ {in_progress, review}).
      columns: {
        columnId: string
        name: string
        columnRole: string
        currentWipLimit: number | null
        currentTaskCount: number
        recommendedWip: number
      }[]
    }
  | {
      ok: false
      reason: 'insufficient_data'
      sampleSize: number
      requiredSamples: number
    }

const RECO_LOOKBACK_DAYS = 30
const RECO_MIN_SAMPLES = 5
const RECO_TARGET_ROLES = new Set(['in_progress', 'review'])

export async function computeWipRecommendations(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<WipRecommendation> {
  requireMinRole(input.actorRole, 'viewer')

  const now = new Date()
  const lookbackStart = new Date(now.getTime() - RECO_LOOKBACK_DAYS * DAY_MS)

  const cycleReport = await computeCycleTime({
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    from: lookbackStart,
    to: now,
    actorRole: input.actorRole,
  })
  if (cycleReport.stats.count < RECO_MIN_SAMPLES) {
    return {
      ok: false,
      reason: 'insufficient_data',
      sampleSize: cycleReport.stats.count,
      requiredSamples: RECO_MIN_SAMPLES,
    }
  }

  const meanHours = cycleReport.stats.meanHours!
  const meanDays = meanHours / 24
  const throughputPerDay = cycleReport.stats.count / RECO_LOOKBACK_DAYS

  // L = λ × W
  const balancedWip = throughputPerDay * meanDays

  return withTenant(input.workspaceId, async (tx) => {
    const targetCols = await tx.execute<{
      columnId: string
      name: string
      columnRole: string
      currentWipLimit: number | null
      currentTaskCount: string
    }>(sql`
      SELECT
        c.id           AS "columnId",
        c.name         AS "name",
        c.column_role  AS "columnRole",
        c.wip_limit    AS "currentWipLimit",
        COUNT(t.id)    AS "currentTaskCount"
      FROM board_columns c
      LEFT JOIN tasks t ON t.column_id = c.id
      WHERE c.board_id = ${input.boardId}
        AND c.column_role IN ('in_progress', 'review')
      GROUP BY c.id, c.name, c.column_role, c.wip_limit, c.position
      ORDER BY c.position
    `)
    const cols = targetCols as unknown as {
      columnId: string
      name: string
      columnRole: string
      currentWipLimit: number | null
      currentTaskCount: string | number
    }[]

    // Spread the balanced WIP across the active columns equally — refining
    // this to per-column proportional split is a Phase 4 task that needs
    // per-column cycle time, which in turn needs richer event analytics.
    const perColumn = cols.length === 0 ? 0 : balancedWip / cols.length

    return {
      ok: true,
      throughputPerDay,
      meanCycleTimeDays: meanDays,
      sampleSize: cycleReport.stats.count,
      columns: cols.map((c) => ({
        columnId: c.columnId,
        name: c.name,
        columnRole: c.columnRole,
        currentWipLimit: c.currentWipLimit,
        currentTaskCount: Number(c.currentTaskCount),
        recommendedWip: Math.max(1, Math.round(perColumn)),
      })),
    }
  })
}
