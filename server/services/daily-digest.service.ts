import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type {
  DailyBlocker,
  DailyChangeItem,
  DailyChangeKind,
  DailyDigest,
  DailyHeatmapRow,
} from '../../shared/types/daily'
import { bucketAge } from '../../shared/utils/daily'
import {
  boardColumns,
  sprintTasks,
  sprints,
  taskEvents,
  tasks,
  type ColumnRole,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { requireMinRole } from '../utils/rbac'
import { computeCycleTime } from './analytics.service'

const DAY_MS = 86_400_000
const WORKING_ROLES: ColumnRole[] = ['in_progress', 'review']

export async function computeDailyDigest(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<DailyDigest> {
  requireMinRole(input.actorRole, 'viewer')

  const now = Date.now()
  const todayStart = new Date(now - DAY_MS)
  const prevStart = new Date(now - 2 * DAY_MS)

  const cycle = await computeCycleTime({
    workspaceId: input.workspaceId,
    boardId: input.boardId,
    from: new Date(now - 90 * DAY_MS),
    to: new Date(now),
    actorRole: input.actorRole,
  })
  const p85Days = cycle.stats.p85Hours === null ? null : Math.round((cycle.stats.p85Hours / 24) * 100) / 100

  const data = await withTenant(input.workspaceId, async (tx) => {
    const columns = await tx
      .select({
        id: boardColumns.id,
        name: boardColumns.name,
        role: boardColumns.columnRole,
        wipLimit: boardColumns.wipLimit,
        position: boardColumns.position,
      })
      .from(boardColumns)
      .where(eq(boardColumns.boardId, input.boardId))
      .orderBy(boardColumns.position)

    const openTasks = await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        columnId: tasks.columnId,
        createdAt: tasks.createdAt,
        blockedReason: tasks.blockedReason,
        assigneeIds: sql<string[]>`COALESCE((
          SELECT array_agg(ta.user_id ORDER BY ta.added_at)
          FROM task_assignees ta WHERE ta.task_id = tasks.id
        ), ARRAY[]::uuid[])`.as('assignee_ids'),
      })
      .from(tasks)
      .where(and(eq(tasks.boardId, input.boardId), sql`${tasks.closedAt} IS NULL`))

    const events = await tx
      .select({
        taskId: taskEvents.taskId,
        eventType: taskEvents.eventType,
        fromColumnId: taskEvents.fromColumnId,
        toColumnId: taskEvents.toColumnId,
        createdAt: taskEvents.createdAt,
        title: tasks.title,
      })
      .from(taskEvents)
      .innerJoin(tasks, eq(tasks.id, taskEvents.taskId))
      .where(and(
        eq(tasks.boardId, input.boardId),
        sql`${taskEvents.createdAt} >= ${prevStart.toISOString()}::timestamptz`,
      ))
      .orderBy(desc(taskEvents.createdAt))

    const blockedIds = openTasks.filter(t => t.blockedReason !== null).map(t => t.id)
    const lastBlocked = blockedIds.length > 0
      ? await tx.execute<{ taskId: string; lastAt: Date }>(sql`
          SELECT task_id AS "taskId", MAX(created_at) AS "lastAt"
          FROM task_events
          WHERE event_type = 'task_blocked' AND task_id IN (${sql.join(blockedIds.map(id => sql`${id}`), sql`, `)})
          GROUP BY task_id
        `)
      : []

    const [activeSprint] = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, input.boardId), eq(sprints.state, 'active')))
    const membership = activeSprint
      ? await tx
          .select({ taskId: sprintTasks.taskId })
          .from(sprintTasks)
          .where(eq(sprintTasks.sprintId, activeSprint.id))
      : []

    return { columns, openTasks, events, lastBlocked, activeSprint, membership }
  })

  const roleById = new Map(data.columns.map(c => [c.id, c.role]))
  const nameById = new Map(data.columns.map(c => [c.id, c.name]))
  const isWorking = (columnId: string | null) =>
    columnId !== null && WORKING_ROLES.includes(roleById.get(columnId) as ColumnRole)

  const inWindow = (d: Date, from: Date, to: Date) =>
    d.getTime() >= from.getTime() && d.getTime() < to.getTime()
  const nowDate = new Date(now)

  const closedToday = data.events.filter(e => e.eventType === 'task_closed' && inWindow(e.createdAt, todayStart, nowDate)).length
  const closedPrev = data.events.filter(e => e.eventType === 'task_closed' && inWindow(e.createdAt, prevStart, todayStart)).length

  const enteredWorking24 = data.events.filter(e =>
    e.eventType === 'task_moved'
    && inWindow(e.createdAt, todayStart, nowDate)
    && isWorking(e.toColumnId) && !isWorking(e.fromColumnId)).length
  const leftWorking24 = data.events.filter(e =>
    inWindow(e.createdAt, todayStart, nowDate)
    && ((e.eventType === 'task_closed' && isWorking(e.fromColumnId))
      || (e.eventType === 'task_moved' && isWorking(e.fromColumnId) && !isWorking(e.toColumnId)))).length

  const blocked24 = data.events.filter(e => e.eventType === 'task_blocked' && inWindow(e.createdAt, todayStart, nowDate)).length
  const unblocked24 = data.events.filter(e => e.eventType === 'task_unblocked' && inWindow(e.createdAt, todayStart, nowDate)).length

  const workingTasks = data.openTasks.filter(t => isWorking(t.columnId))
  const ageDaysOf = (createdAt: Date) => (now - createdAt.getTime()) / DAY_MS

  const agingTasks = workingTasks
    .map(t => ({ t, ageDays: ageDaysOf(t.createdAt) }))
    .filter(({ ageDays }) => p85Days !== null && ageDays > p85Days)
    .map(({ t, ageDays }) => ({
      taskId: t.id,
      title: t.title,
      columnId: t.columnId,
      columnName: nameById.get(t.columnId) ?? '',
      ageDays: Math.round(ageDays * 10) / 10,
      overP85Days: Math.round((ageDays - (p85Days ?? 0)) * 10) / 10,
      assigneeIds: t.assigneeIds,
    }))
    .sort((a, b) => b.overP85Days - a.overP85Days)

  const newlyAging = p85Days === null
    ? 0
    : workingTasks.filter((t) => {
        const age = ageDaysOf(t.createdAt)
        return age > p85Days && age - 1 <= p85Days
      }).length

  const heatmap: DailyHeatmapRow[] = data.columns
    .filter(c => WORKING_ROLES.includes(c.role))
    .map((c) => {
      const colTasks = workingTasks.filter(t => t.columnId === c.id)
      const row = { columnId: c.id, columnName: c.name, fresh: 0, approaching: 0, overdue: 0 }
      for (const t of colTasks) row[bucketAge(ageDaysOf(t.createdAt), p85Days)] += 1
      return row
    })

  const lastBlockedAt = new Map(
    (data.lastBlocked as unknown as { taskId: string; lastAt: Date }[]).map(r => [r.taskId, new Date(r.lastAt)]),
  )
  const blockers: DailyBlocker[] = data.openTasks
    .filter(t => t.blockedReason !== null)
    .map((t) => {
      const at = lastBlockedAt.get(t.id) ?? null
      return {
        taskId: t.id,
        title: t.title,
        reason: t.blockedReason,
        blockedDays: at ? Math.round(((now - at.getTime()) / DAY_MS) * 10) / 10 : 0,
        sinceISO: at?.toISOString() ?? null,
      }
    })
    .sort((a, b) => b.blockedDays - a.blockedDays)

  const wipViolations = data.columns
    .filter(c => WORKING_ROLES.includes(c.role) && c.wipLimit !== null)
    .map(c => ({
      columnId: c.id,
      columnName: c.name,
      count: workingTasks.filter(t => t.columnId === c.id).length,
      limit: c.wipLimit!,
    }))
    .filter(v => v.count > v.limit)

  const membershipIds = new Set(data.membership.map(m => m.taskId))
  const sprintRisk = data.activeSprint
    ? {
        sprintId: data.activeSprint.id,
        sprintName: data.activeSprint.name,
        horizonDays: data.activeSprint.plannedEndAt
          ? Math.round(((data.activeSprint.plannedEndAt.getTime() - now) / DAY_MS) * 10) / 10
          : null,
        atRisk: agingTasks
          .filter(a => membershipIds.has(a.taskId))
          .map(a => ({ taskId: a.taskId, title: a.title, ageDays: a.ageDays })),
      }
    : null

  const CHANGE_MAP: Partial<Record<string, DailyChangeKind>> = {
    task_closed: 'closed',
    task_moved: 'moved',
    task_blocked: 'blocked',
    task_unblocked: 'unblocked',
    task_added_to_sprint: 'added_to_sprint',
    task_removed_from_sprint: 'removed_from_sprint',
  }
  const changes: Record<DailyChangeKind, number> = {
    closed: 0, moved: 0, blocked: 0, unblocked: 0, added_to_sprint: 0, removed_from_sprint: 0,
  }
  const changeItems: DailyChangeItem[] = []
  for (const e of data.events) {
    if (!inWindow(e.createdAt, todayStart, nowDate)) continue
    const kind = CHANGE_MAP[e.eventType]
    if (!kind) continue
    changes[kind] += 1
    if (changeItems.length < 40) {
      changeItems.push({ taskId: e.taskId, title: e.title, kind, atISO: e.createdAt.toISOString() })
    }
  }

  const blockedNow = data.openTasks.filter(t => t.blockedReason !== null).length

  return {
    stats: {
      done: { value: closedToday, delta: closedToday - closedPrev },
      wip: { value: workingTasks.length, delta: enteredWorking24 - leftWorking24 },
      blocked: { value: blockedNow, delta: blocked24 - unblocked24 },
      aging: { value: agingTasks.length, delta: newlyAging },
    },
    p85Days,
    aging: agingTasks,
    heatmap,
    blockers,
    wipViolations,
    sprintRisk,
    changes,
    changeItems,
  }
}
