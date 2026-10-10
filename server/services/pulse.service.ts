import { and, eq, isNull, sql } from 'drizzle-orm'
import type { BoardPulse } from '#shared/types/pulse'
import { boards, sprintTasks, sprints, tasks, type WorkspaceMemberRole } from '../db/schema'
import { withTenant } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'
import { computeCycleTime, computeMonteCarlo } from './analytics.service'
import { listOpenFirings } from './automations.service'

const DAY_MS = 86_400_000

type WipRow = { columnId: string; name: string; count: number | string; limit: number | string | null }

type OpenRow = {
  id: string
  title: string
  mine: boolean
  columnRole: string
  createdAt: Date | string
  dueDate: Date | string | null
  blockedSince: Date | string | null
}

type CloseRow = { day: string; n: number | string }

const round1 = (n: number) => Math.round(n * 10) / 10

export async function computeBoardPulse(input: {
  workspaceId: string
  boardId: string
  userId: string
  actorRole: WorkspaceMemberRole
}): Promise<BoardPulse> {
  requireMinRole(input.actorRole, 'viewer')
  const now = Date.now()

  const cycle = await computeCycleTime({
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    from: new Date(now - 90 * DAY_MS),
    to: new Date(now),
    actorRole: input.actorRole,
  })
  const p85Days = cycle.stats.p85Hours === null ? null : round1(cycle.stats.p85Hours / 24)

  const data = await withTenant(input.workspaceId, async (tx) => {
    const [board] = await tx
      .select({
        id: boards.id,
        name: boards.name,
        sleDays: boards.sleDays,
        lastAt: boards.lastReplenishmentAt,
        periodDays: boards.replenishmentPeriodDays,
      })
      .from(boards)
      .where(eq(boards.id, input.boardId))
    if (!board) throw new NotFoundError('Доска не найдена')

    const wip = (await tx.execute<WipRow>(sql`
      SELECT c.id AS "columnId", c.name, COUNT(t.id)::int AS "count", c.wip_limit AS "limit"
      FROM board_columns c
      LEFT JOIN tasks t ON t.column_id = c.id AND t.closed_at IS NULL
      WHERE c.board_id = ${input.boardId} AND c.column_role IN ('in_progress', 'review')
      GROUP BY c.id, c.name, c.wip_limit, c.position
      ORDER BY c.position
    `)) as unknown as WipRow[]

    const open = (await tx.execute<OpenRow>(sql`
      SELECT
        t.id,
        t.title,
        (t.assignee_id = ${input.userId}
          OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ${input.userId})) AS "mine",
        c.column_role AS "columnRole",
        t.created_at AS "createdAt",
        t.due_date AS "dueDate",
        CASE WHEN t.blocked_reason IS NULL THEN NULL
          ELSE (SELECT MAX(e.created_at) FROM task_events e WHERE e.task_id = t.id AND e.event_type = 'task_blocked')
        END AS "blockedSince"
      FROM tasks t
      JOIN board_columns c ON c.id = t.column_id
      WHERE t.board_id = ${input.boardId} AND t.closed_at IS NULL AND c.column_role <> 'archived'
    `)) as unknown as OpenRow[]

    const closes = (await tx.execute<CloseRow>(sql`
      SELECT to_char(date_trunc('day', e.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
      FROM task_events e
      JOIN tasks t ON t.id = e.task_id
      WHERE t.board_id = ${input.boardId}
        AND e.event_type = 'task_closed'
        AND e.created_at >= now() - interval '7 days'
      GROUP BY 1
    `)) as unknown as CloseRow[]

    const [sprint] = await tx
      .select({ id: sprints.id, name: sprints.name, startedAt: sprints.startedAt, plannedEndAt: sprints.plannedEndAt })
      .from(sprints)
      .where(and(eq(sprints.boardId, input.boardId), eq(sprints.state, 'active')))
      .limit(1)
    let remaining = 0
    if (sprint) {
      const [agg] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(sprintTasks)
        .innerJoin(tasks, eq(tasks.id, sprintTasks.taskId))
        .where(and(eq(sprintTasks.sprintId, sprint.id), isNull(tasks.closedAt)))
      remaining = agg?.n ?? 0
    }
    return { board, wip, open, closes, sprint, remaining }
  })

  const firings = await listOpenFirings({
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    actorRole: input.actorRole,
  })

  const isWorking = (role: string) => role === 'in_progress' || role === 'review'
  const working = data.open.filter((t) => isWorking(t.columnRole))
  const agingCount =
    p85Days === null ? 0 : working.filter((t) => (now - new Date(t.createdAt).getTime()) / DAY_MS > p85Days).length
  const blockedDays = data.open
    .filter((t) => t.blockedSince)
    .map((t) => (now - new Date(t.blockedSince!).getTime()) / DAY_MS)
  const mine = data.open.filter((t) => t.mine)
  const dueSoon =
    mine
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0] ?? null

  const days = Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * DAY_MS).toISOString().slice(0, 10))
  const byDay = new Map(data.closes.map((c) => [c.day, Number(c.n)]))

  let sprintOut: BoardPulse['sprint'] = null
  if (data.sprint?.startedAt && data.sprint.plannedEndAt) {
    const start = new Date(data.sprint.startedAt).getTime()
    const end = new Date(data.sprint.plannedEndAt).getTime()
    const daysLeft = Math.max(0, Math.ceil((end - now) / DAY_MS))
    let probability: number | null = null
    if (data.remaining > 0 && daysLeft > 0) {
      const r = await computeMonteCarlo({
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        tasksRemaining: data.remaining,
        horizonDays: daysLeft,
        actorRole: input.actorRole,
      })
      if (r.ok) probability = Math.round(r.probability * 100)
    }
    sprintOut = {
      id: data.sprint.id,
      name: data.sprint.name,
      pct: end > start ? Math.round(Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))) : 0,
      daysLeft,
      probability,
    }
  }

  return {
    board: {
      id: data.board.id,
      name: data.board.name,
      sleDays: data.board.sleDays,
      replenishment: {
        lastAt: data.board.lastAt ? new Date(data.board.lastAt).toISOString() : null,
        periodDays: data.board.periodDays,
      },
    },
    wip: data.wip.map((c) => ({
      columnId: c.columnId,
      name: c.name,
      count: Number(c.count),
      limit: c.limit === null ? null : Number(c.limit),
    })),
    aging: { count: agingCount, p85Days },
    blockers: {
      count: blockedDays.length,
      longestDays: blockedDays.length ? round1(Math.max(...blockedDays)) : null,
    },
    firings: { count: firings.length, latestTrigger: firings[0]?.trigger ?? null },
    myTasks: { open: mine.length, inProgress: mine.filter((t) => isWorking(t.columnRole)).length },
    dueSoon: dueSoon
      ? { taskId: dueSoon.id, title: dueSoon.title, dueDate: new Date(dueSoon.dueDate!).toISOString() }
      : null,
    throughput7: days.map((d) => byDay.get(d) ?? 0),
    sprint: sprintOut,
  }
}
