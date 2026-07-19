import { and, asc, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import type {
  SprintReportCarryOver,
  SprintReportPayload,
  SprintReportScopeChange,
  SprintReportTaskRow,
} from '../../shared/types/sprint-report'
import {
  sprintEvents,
  sprintReports,
  sprintScenarios,
  sprintTasks,
  sprints,
  taskEvents,
  tasks,
  type ServiceClass,
  type SprintReportRow,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors'
import { percentileSorted } from '../utils/network-planning'
import { requireMinRole } from '../utils/rbac'
import { listSprintSnapshots } from './forecast-snapshots.service'
import { computeBurndown } from './sprints.service'

const DAY_MS = 86_400_000
const START_GRACE_MS = 60_000

export async function getSprintReport(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintReportRow> {
  requireMinRole(input.actorRole, 'viewer')
  const [row] = await withTenant(input.workspaceId, tx =>
    tx.select().from(sprintReports).where(eq(sprintReports.sprintId, input.sprintId)))
  if (!row) throw new NotFoundError('Отчёт по спринту ещё не сформирован')
  return row
}

export async function generateSprintReport(input: {
  workspaceId: string
  sprintId: string
  actorId?: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintReportRow> {
  requireMinRole(input.actorRole, 'scrum_master')

  const payload = await buildSprintReportPayload(input)

  const [row] = await withTenant(input.workspaceId, tx =>
    tx
      .insert(sprintReports)
      .values({
        sprintId: input.sprintId,
        workspaceId: input.workspaceId,
        payload,
        generatedBy: input.actorId ?? null,
      })
      .onConflictDoNothing()
      .returning())
  if (!row) {
    throw new ConflictError('Отчёт по этому спринту уже сформирован — он неизменен')
  }
  return row
}

export async function buildSprintReportPayload(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintReportPayload> {
  const data = await withTenant(input.workspaceId, async (tx) => {
    const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
    if (!sprint) throw new NotFoundError('Спринт не найден')
    if (sprint.state !== 'closed') {
      throw new ValidationError('Отчёт формируется только по закрытому спринту')
    }

    const memberRows = await tx
      .select({
        taskId: tasks.id,
        title: tasks.title,
        storyPoints: tasks.storyPoints,
        serviceClass: tasks.serviceClass,
        closedAt: tasks.closedAt,
        createdAt: tasks.createdAt,
        addedAt: sprintTasks.addedAt,
      })
      .from(sprintTasks)
      .innerJoin(tasks, eq(tasks.id, sprintTasks.taskId))
      .where(eq(sprintTasks.sprintId, input.sprintId))

    const events = await tx
      .select()
      .from(sprintEvents)
      .where(eq(sprintEvents.sprintId, input.sprintId))
      .orderBy(asc(sprintEvents.createdAt))

    const membershipEvents = await tx
      .select({
        taskId: taskEvents.taskId,
        eventType: taskEvents.eventType,
        actorId: taskEvents.actorId,
        payload: taskEvents.payload,
        createdAt: taskEvents.createdAt,
      })
      .from(taskEvents)
      .where(and(
        inArray(taskEvents.eventType, ['task_added_to_sprint', 'task_removed_from_sprint']),
        sql`${taskEvents.payload}->>'sprintId' = ${input.sprintId}`,
      ))
      .orderBy(asc(taskEvents.createdAt))

    const eventTaskIds = [...new Set(membershipEvents.map(e => e.taskId))]
    const eventTaskTitles = eventTaskIds.length > 0
      ? await tx
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(inArray(tasks.id, eventTaskIds))
      : []

    const memberIds = memberRows.map(r => r.taskId)
    const createdEvents = memberIds.length > 0
      ? await tx
          .select({ taskId: taskEvents.taskId, createdAt: taskEvents.createdAt })
          .from(taskEvents)
          .where(and(
            eq(taskEvents.eventType, 'task_created'),
            inArray(taskEvents.taskId, memberIds),
          ))
      : []

    const closedEventRow = events.find(e => e.eventType === 'sprint_closed')
    const closedCarry = ((closedEventRow?.payload ?? {}) as {
      carryOver?: { taskId: string; decision: string }[]
    }).carryOver ?? []
    const memberIdSet = new Set(memberRows.map(r => r.taskId))
    const missingCarryIds = closedCarry
      .map(c => c.taskId)
      .filter(id => !memberIdSet.has(id))
    const missingCarryRows = missingCarryIds.length > 0
      ? await tx
          .select({
            taskId: tasks.id,
            title: tasks.title,
            storyPoints: tasks.storyPoints,
            serviceClass: tasks.serviceClass,
            createdAt: tasks.createdAt,
          })
          .from(tasks)
          .where(inArray(tasks.id, missingCarryIds))
      : []

    const openIds = [
      ...memberRows.filter(r => r.closedAt === null).map(r => r.taskId),
      ...missingCarryIds,
    ]
    const priorClosedEvents = openIds.length > 0
      ? await tx
          .select({ payload: sprintEvents.payload })
          .from(sprintEvents)
          .innerJoin(sprints, eq(sprints.id, sprintEvents.sprintId))
          .where(and(
            eq(sprintEvents.eventType, 'sprint_closed'),
            ne(sprintEvents.sprintId, input.sprintId),
            eq(sprints.boardId, sprint.boardId),
            lt(sprints.createdAt, sprint.createdAt),
          ))
      : []
    const openIdSet = new Set(openIds)
    const priorMemberships: { taskId: string }[] = []
    for (const e of priorClosedEvents) {
      const carry = ((e.payload ?? {}) as { carryOver?: { taskId: string }[] }).carryOver ?? []
      for (const c of carry) {
        if (openIdSet.has(c.taskId)) priorMemberships.push({ taskId: c.taskId })
      }
    }

    const scenarios = await tx
      .select()
      .from(sprintScenarios)
      .where(eq(sprintScenarios.sprintId, input.sprintId))
      .orderBy(desc(sprintScenarios.appliedAt))

    return { sprint, memberRows, events, membershipEvents, eventTaskTitles, createdEvents, priorMemberships, scenarios, missingCarryRows }
  })

  const { sprint } = data
  const startMs = (sprint.startedAt ?? sprint.plannedStartAt)?.getTime() ?? null
  const endMs = (sprint.endedAt ?? sprint.plannedEndAt)?.getTime() ?? null

  const closedEvent = data.events.find(e => e.eventType === 'sprint_closed')
  const closedPayload = (closedEvent?.payload ?? {}) as {
    goalAchieved?: boolean | null
    goalComment?: string | null
    carryOver?: { taskId: string; decision: SprintReportCarryOver['decision'] }[]
  }
  const decisionByTask = new Map(
    (closedPayload.carryOver ?? []).map(c => [c.taskId, c.decision] as const),
  )

  const datesChanges = data.events.filter(e => e.eventType === 'dates_changed')
  const extensionChanges = datesChanges.map((e) => {
    const p = e.payload as { fromEnd?: string | null; toEnd?: string | null; reason?: string | null }
    const from = p.fromEnd ? new Date(p.fromEnd).getTime() : null
    const to = p.toEnd ? new Date(p.toEnd).getTime() : null
    const days = from !== null && to !== null ? Math.round(((to - from) / DAY_MS) * 10) / 10 : 0
    return { atISO: e.createdAt.toISOString(), days, reason: p.reason ?? null }
  })

  const addedAtByTask = new Map<string, Date>()
  for (const e of data.membershipEvents) {
    if (e.eventType === 'task_added_to_sprint') addedAtByTask.set(e.taskId, e.createdAt)
  }
  const allMembers = [
    ...data.memberRows,
    ...data.missingCarryRows.map(r => ({
      taskId: r.taskId,
      title: r.title,
      storyPoints: r.storyPoints,
      serviceClass: r.serviceClass,
      closedAt: null as Date | null,
      createdAt: r.createdAt,
      addedAt: addedAtByTask.get(r.taskId) ?? r.createdAt,
    })),
  ]

  const titleByEventTask = new Map(data.eventTaskTitles.map(t => [t.id, t.title]))
  const CLOSE_REASONS = new Set(['close_to_backlog', 'close_to_next_sprint', 'carry_over'])
  const scopeChanges: SprintReportScopeChange[] = startMs === null
    ? []
    : data.membershipEvents
        .filter(e => e.createdAt.getTime() > startMs + START_GRACE_MS)
        .filter(e => !CLOSE_REASONS.has(((e.payload ?? {}) as { reason?: string }).reason ?? ''))
        .map(e => ({
          taskId: e.taskId,
          title: titleByEventTask.get(e.taskId) ?? '…',
          kind: e.eventType === 'task_added_to_sprint' ? 'added' as const : 'removed' as const,
          atISO: e.createdAt.toISOString(),
          actorId: e.actorId,
          reason: ((e.payload ?? {}) as { reason?: string }).reason ?? null,
        }))

  const removedAfterStart = scopeChanges.filter(c => c.kind === 'removed')
  const currentIds = new Set(allMembers.map(r => r.taskId))
  const removedRows: SprintReportTaskRow[] = removedAfterStart
    .filter(c => !currentIds.has(c.taskId))
    .map(c => ({
      taskId: c.taskId,
      title: c.title,
      storyPoints: null,
      serviceClass: 'standard' as ServiceClass,
      status: 'removed' as const,
      addedAtISO: null,
      closedAtISO: null,
      cycleDays: null,
    }))

  const createdAtByTask = new Map(data.createdEvents.map(e => [e.taskId, e.createdAt.getTime()]))
  const deliveredRows = allMembers.filter(r =>
    r.closedAt !== null && (endMs === null || r.closedAt.getTime() <= endMs + START_GRACE_MS))
  const openRows = allMembers.filter(r => r.closedAt === null)
  const startRows = startMs === null
    ? allMembers
    : allMembers.filter(r => r.addedAt.getTime() <= startMs + START_GRACE_MS)

  const streakByTask = new Map<string, number>()
  for (const m of data.priorMemberships) {
    streakByTask.set(m.taskId, (streakByTask.get(m.taskId) ?? 0) + 1)
  }

  const carryOver: SprintReportCarryOver[] = openRows.map(r => ({
    taskId: r.taskId,
    title: r.title,
    storyPoints: r.storyPoints,
    decision: decisionByTask.get(r.taskId) ?? null,
    streak: (streakByTask.get(r.taskId) ?? 0) + 1,
  }))

  const cycleDaysFor = (r: (typeof allMembers)[number]): number | null => {
    if (!r.closedAt) return null
    const created = createdAtByTask.get(r.taskId) ?? r.createdAt.getTime()
    return Math.max(0.01, Math.round(((r.closedAt.getTime() - created) / DAY_MS) * 100) / 100)
  }

  const taskRows: SprintReportTaskRow[] = [
    ...allMembers.map(r => ({
      taskId: r.taskId,
      title: r.title,
      storyPoints: r.storyPoints,
      serviceClass: r.serviceClass,
      status: r.closedAt !== null ? ('delivered' as const) : ('carry_over' as const),
      addedAtISO: r.addedAt.toISOString(),
      closedAtISO: r.closedAt?.toISOString() ?? null,
      cycleDays: cycleDaysFor(r),
    })),
    ...removedRows,
  ]

  const cycleValues = taskRows
    .map(r => r.cycleDays)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)

  const durationDays = startMs !== null && endMs !== null
    ? Math.max(1 / 24, (endMs - startMs) / DAY_MS)
    : null

  const sumSp = (rows: { storyPoints: number | null }[]) =>
    rows.reduce((acc, r) => acc + (r.storyPoints ?? 0), 0)

  const distribution = new Map<ServiceClass, { count: number; sp: number }>()
  for (const r of allMembers) {
    const entry = distribution.get(r.serviceClass) ?? { count: 0, sp: 0 }
    entry.count += 1
    entry.sp += r.storyPoints ?? 0
    distribution.set(r.serviceClass, entry)
  }

  const burndown = await computeBurndown({
    workspaceId: input.workspaceId,
    sprintId: input.sprintId,
    actorRole: input.actorRole,
  }).catch(() => null)

  const snapshots = await listSprintSnapshots({
    workspaceId: input.workspaceId,
    sprintId: input.sprintId,
    actorRole: input.actorRole,
  }).catch(() => [])
  const startSnapshot = snapshots.find(s => s.trigger === 'sprint_start')
  const closeSnapshot = snapshots.find(s => s.trigger === 'sprint_close')

  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      plannedStartAt: sprint.plannedStartAt?.toISOString() ?? null,
      plannedEndAt: sprint.plannedEndAt?.toISOString() ?? null,
      startedAt: sprint.startedAt?.toISOString() ?? null,
      endedAt: sprint.endedAt?.toISOString() ?? null,
      factDurationDays: durationDays === null ? null : Math.round(durationDays * 10) / 10,
    },
    extensions: {
      totalEndShiftDays: Math.round(extensionChanges.reduce((acc, c) => acc + c.days, 0) * 10) / 10,
      changes: extensionChanges,
    },
    goal: {
      achieved: closedPayload.goalAchieved ?? null,
      comment: closedPayload.goalComment ?? null,
    },
    totals: {
      startCount: startRows.length,
      startSp: sumSp(startRows),
      deliveredCount: deliveredRows.length,
      deliveredSp: sumSp(deliveredRows),
      carryOverCount: openRows.length,
      carryOverSp: sumSp(openRows),
      addedAfterStartCount: scopeChanges.filter(c => c.kind === 'added').length,
      removedAfterStartCount: removedAfterStart.length,
    },
    scopeChanges,
    carryOver,
    tasks: taskRows,
    burndown,
    forecastVsFact: {
      start: startSnapshot?.payload ?? null,
      close: closeSnapshot?.payload ?? null,
    },
    appliedScenarios: data.scenarios
      .filter(s => s.appliedAt !== null)
      .map(s => ({
        id: s.id,
        name: s.name,
        appliedAtISO: s.appliedAt!.toISOString(),
        appliedBy: s.appliedBy,
        changesCount: s.changes.length,
      })),
    flow: {
      throughputPerWeek: durationDays === null || deliveredRows.length === 0
        ? null
        : Math.round((deliveredRows.length / durationDays) * 7 * 10) / 10,
      cycleP50: cycleValues.length > 0 ? Math.round(percentileSorted(cycleValues, 50) * 10) / 10 : null,
      cycleP85: cycleValues.length > 0 ? Math.round(percentileSorted(cycleValues, 85) * 10) / 10 : null,
      cycleDistribution: cycleValues,
      agingOpenAtClose: endMs === null
        ? []
        : openRows.map(r => ({
            taskId: r.taskId,
            title: r.title,
            ageDays: Math.max(0, Math.round(((endMs - (createdAtByTask.get(r.taskId) ?? r.createdAt.getTime())) / DAY_MS) * 10) / 10),
          })),
    },
    serviceClassDistribution: [...distribution.entries()].map(([serviceClass, v]) => ({
      serviceClass,
      count: v.count,
      sp: v.sp,
    })),
  }
}
