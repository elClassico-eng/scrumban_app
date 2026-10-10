import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm'
import type { AutomationTrigger } from '#shared/types/automation'
import { boardColumns, boards, sprintTasks, sprints, taskEvents, tasks } from '../db/schema'
import { computeMonteCarlo } from '../services/analytics.service'
import type { Subject } from './automation-diff'
import type { DbTransaction } from './db'

export type EvaluatorContext = {
  workspaceId: string
  boardId: string
  trigger: AutomationTrigger
  params: Record<string, unknown>
}

const DAY_MS = 86_400_000

const round1 = (n: number) => Math.round(n * 10) / 10

export async function evaluateTrigger(tx: DbTransaction, ctx: EvaluatorContext): Promise<Subject[]> {
  switch (ctx.trigger) {
    case 'task_aging':
      return taskAging(tx, ctx)
    case 'task_blocked':
      return taskBlocked(tx, ctx)
    case 'sprint_forecast':
      return sprintForecast(tx, ctx)
    case 'wip_exceeded':
      return wipExceeded(tx, ctx)
    case 'replenishment_overdue':
      return replenishmentOverdue(tx, ctx)
  }
}

async function taskAging(tx: DbTransaction, ctx: EvaluatorContext): Promise<Subject[]> {
  const threshold = Number(ctx.params.thresholdPct ?? 85) / 100
  const [board] = await tx.select({ sleDays: boards.sleDays }).from(boards).where(eq(boards.id, ctx.boardId))
  if (!board?.sleDays) return []

  const rows = await tx
    .select({
      taskId: tasks.id,
      taskTitle: tasks.title,
      assigneeId: tasks.assigneeId,
      createdAt: tasks.createdAt,
      columnId: tasks.columnId,
      columnName: boardColumns.name,
    })
    .from(tasks)
    .innerJoin(boardColumns, eq(boardColumns.id, tasks.columnId))
    .where(
      and(
        eq(tasks.boardId, ctx.boardId),
        isNull(tasks.closedAt),
        sql`${boardColumns.columnRole} IN ('in_progress', 'review')`,
      ),
    )

  const out: Subject[] = []
  for (const r of rows) {
    const [moved] = await tx
      .select({ at: taskEvents.createdAt })
      .from(taskEvents)
      .where(
        and(
          eq(taskEvents.taskId, r.taskId),
          eq(taskEvents.eventType, 'task_moved'),
          eq(taskEvents.toColumnId, r.columnId),
        ),
      )
      .orderBy(desc(taskEvents.createdAt))
      .limit(1)
    const ageDays = (Date.now() - new Date(moved?.at ?? r.createdAt).getTime()) / DAY_MS
    const ratio = ageDays / board.sleDays
    if (ratio < threshold) continue
    out.push({
      subjectType: 'task',
      subjectId: r.taskId,
      payload: {
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        boardId: ctx.boardId,
        columnName: r.columnName,
        assigneeId: r.assigneeId,
        ageDays: round1(ageDays),
        sleDays: board.sleDays,
        pct: Math.round(ratio * 100),
      },
    })
  }
  return out
}

type BlockedRow = {
  taskId: string
  taskTitle: string
  assigneeId: string | null
  reason: string
  since: Date | string | null
}

async function taskBlocked(tx: DbTransaction, ctx: EvaluatorContext): Promise<Subject[]> {
  const minDays = Number(ctx.params.days ?? 2)
  const rows = (await tx.execute<BlockedRow>(sql`
    SELECT
      t.id AS "taskId",
      t.title AS "taskTitle",
      t.assignee_id AS "assigneeId",
      t.blocked_reason AS "reason",
      (SELECT MAX(e.created_at) FROM task_events e
        WHERE e.task_id = t.id AND e.event_type = 'task_blocked') AS "since"
    FROM tasks t
    WHERE t.board_id = ${ctx.boardId}
      AND t.closed_at IS NULL
      AND t.blocked_reason IS NOT NULL
  `)) as unknown as BlockedRow[]

  return rows.flatMap((r) => {
    if (!r.since) return []
    const days = (Date.now() - new Date(r.since).getTime()) / DAY_MS
    if (days < minDays) return []
    return [
      {
        subjectType: 'task' as const,
        subjectId: r.taskId,
        payload: {
          taskId: r.taskId,
          taskTitle: r.taskTitle,
          boardId: ctx.boardId,
          assigneeId: r.assigneeId,
          reason: r.reason,
          days: round1(days),
        },
      },
    ]
  })
}

async function sprintForecast(tx: DbTransaction, ctx: EvaluatorContext): Promise<Subject[]> {
  const minProbability = Number(ctx.params.minProbability ?? 70) / 100
  const active = await tx
    .select({ id: sprints.id, name: sprints.name, plannedEndAt: sprints.plannedEndAt })
    .from(sprints)
    .where(
      and(
        eq(sprints.boardId, ctx.boardId),
        eq(sprints.state, 'active'),
        isNotNull(sprints.plannedEndAt),
        gt(sprints.plannedEndAt, new Date()),
      ),
    )

  const out: Subject[] = []
  for (const s of active) {
    const [agg] = await tx
      .select({ remaining: sql<number>`count(*)::int` })
      .from(sprintTasks)
      .innerJoin(tasks, eq(tasks.id, sprintTasks.taskId))
      .where(and(eq(sprintTasks.sprintId, s.id), isNull(tasks.closedAt)))
    const tasksRemaining = agg?.remaining ?? 0
    if (tasksRemaining === 0) continue
    const daysLeft = Math.ceil((new Date(s.plannedEndAt!).getTime() - Date.now()) / DAY_MS)
    if (daysLeft <= 0) continue
    const report = await computeMonteCarlo({
      workspaceId: ctx.workspaceId,
      boardId: ctx.boardId,
      tasksRemaining,
      horizonDays: daysLeft,
      actorRole: 'viewer',
    })
    if (!report.ok || report.probability >= minProbability) continue
    out.push({
      subjectType: 'sprint',
      subjectId: s.id,
      payload: {
        sprintId: s.id,
        sprintName: s.name,
        boardId: ctx.boardId,
        probability: Math.round(report.probability * 100),
        tasksRemaining,
        daysLeft,
      },
    })
  }
  return out
}

type WipRow = { columnId: string; columnName: string; count: number | string; limit: number | string }

async function wipExceeded(tx: DbTransaction, ctx: EvaluatorContext): Promise<Subject[]> {
  const rows = (await tx.execute<WipRow>(sql`
    SELECT c.id AS "columnId", c.name AS "columnName", COUNT(t.id)::int AS "count", c.wip_limit AS "limit"
    FROM board_columns c
    LEFT JOIN tasks t ON t.column_id = c.id AND t.closed_at IS NULL
    WHERE c.board_id = ${ctx.boardId}
      AND c.wip_limit IS NOT NULL
      AND c.column_role IN ('in_progress', 'review')
    GROUP BY c.id, c.name, c.wip_limit
    HAVING COUNT(t.id) > c.wip_limit
  `)) as unknown as WipRow[]

  return rows.map((r) => ({
    subjectType: 'column' as const,
    subjectId: r.columnId,
    payload: {
      columnId: r.columnId,
      columnName: r.columnName,
      boardId: ctx.boardId,
      count: Number(r.count),
      limit: Number(r.limit),
    },
  }))
}

async function replenishmentOverdue(tx: DbTransaction, ctx: EvaluatorContext): Promise<Subject[]> {
  const [b] = await tx
    .select({
      id: boards.id,
      name: boards.name,
      last: boards.lastReplenishmentAt,
      period: boards.replenishmentPeriodDays,
    })
    .from(boards)
    .where(eq(boards.id, ctx.boardId))
  if (!b?.last) return []
  const daysOverdue = Math.floor((Date.now() - new Date(b.last).getTime()) / DAY_MS) - b.period
  if (daysOverdue < 0) return []
  return [
    {
      subjectType: 'board',
      subjectId: b.id,
      payload: { boardId: b.id, boardName: b.name, daysOverdue },
    },
  ]
}
