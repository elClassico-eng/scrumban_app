import { and, desc, eq, gt, gte, isNotNull, isNull, sql } from 'drizzle-orm'
import {
  boardColumns,
  boards,
  notifications,
  sprintTasks,
  sprints,
  taskEvents,
  tasks,
  workspaceMembers,
  workspaces,
} from '../db/schema'
import { setUserContext, useDB, withTenant } from '../utils/db'
import { computeMonteCarlo } from './analytics.service'
import { emitNotification } from './notifications.service'

const SLE_BREACH_THRESHOLD = 0.85
const SPRINT_FORECAST_THRESHOLD = 0.70
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000
const FLOW_ALERT_ROLES = ['owner', 'admin', 'scrum_master'] as const

export interface FlowAlertResult {
  scanned: number
  emitted: number
}

export async function checkSleBreaches(): Promise<FlowAlertResult> {
  const wsList = await useDB().select({ id: workspaces.id }).from(workspaces)

  let scanned = 0
  let emitted = 0

  for (const ws of wsList) {
    const inner = await withTenant(ws.id, async (tx) => {
      const rows = await tx
        .select({
          taskId: tasks.id,
          taskTitle: tasks.title,
          boardId: tasks.boardId,
          columnId: tasks.columnId,
          assigneeId: tasks.assigneeId,
          createdAt: tasks.createdAt,
          sleDays: boards.sleDays,
        })
        .from(tasks)
        .innerJoin(boards, eq(boards.id, tasks.boardId))
        .innerJoin(boardColumns, eq(boardColumns.id, tasks.columnId))
        .where(and(
          isNotNull(tasks.assigneeId),
          isNotNull(boards.sleDays),
          isNull(tasks.closedAt),
          sql`${boardColumns.columnRole} <> 'done'`,
        ))

      let localScanned = 0
      let localEmitted = 0

      for (const row of rows) {
        localScanned += 1
        const moved = await tx
          .select({ createdAt: taskEvents.createdAt })
          .from(taskEvents)
          .where(and(
            eq(taskEvents.taskId, row.taskId),
            eq(taskEvents.eventType, 'task_moved'),
            eq(taskEvents.toColumnId, row.columnId),
          ))
          .orderBy(desc(taskEvents.createdAt))
          .limit(1)

        const enteredAt = moved[0]?.createdAt ?? row.createdAt
        const ageMs = Date.now() - new Date(enteredAt).getTime()
        const ageDays = ageMs / 86_400_000
        const ratio = ageDays / row.sleDays!
        if (ratio < SLE_BREACH_THRESHOLD) continue

        const wasEmitted = await emitIfFresh({
          tx,
          workspaceId: ws.id,
          recipientId: row.assigneeId!,
          type: 'sle_breach',
          dedupeKey: `taskId=${row.taskId}`,
          payload: {
            taskId: row.taskId,
            boardId: row.boardId,
            taskTitle: row.taskTitle,
            agePct: Math.round(ratio * 100),
          },
        })
        if (wasEmitted) localEmitted += 1
      }

      return { localScanned, localEmitted }
    })

    scanned += inner.localScanned
    emitted += inner.localEmitted
  }

  return { scanned, emitted }
}

export async function checkReplenishment(): Promise<FlowAlertResult> {
  const wsList = await useDB().select({ id: workspaces.id }).from(workspaces)

  let scanned = 0
  let emitted = 0

  for (const ws of wsList) {
    const inner = await withTenant(ws.id, async (tx) => {
      const overdueBoards = await tx
        .select({
          id: boards.id,
          name: boards.name,
          lastReplenishmentAt: boards.lastReplenishmentAt,
          period: boards.replenishmentPeriodDays,
        })
        .from(boards)
        .where(and(
          isNotNull(boards.lastReplenishmentAt),
          sql`${boards.lastReplenishmentAt} + (${boards.replenishmentPeriodDays} * INTERVAL '1 day') < now()`,
        ))

      let localEmitted = 0
      let localScanned = 0

      if (overdueBoards.length === 0) return { localScanned, localEmitted }

      const recipients = await useDB()
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(and(
          eq(workspaceMembers.workspaceId, ws.id),
          sql`${workspaceMembers.role} IN ('owner', 'admin', 'scrum_master')`,
        ))

      for (const board of overdueBoards) {
        localScanned += 1
        const daysOverdue = Math.floor(
          (Date.now() - new Date(board.lastReplenishmentAt!).getTime()) / 86_400_000,
        ) - board.period

        for (const r of recipients) {
          const wasEmitted = await emitIfFresh({
            tx,
            workspaceId: ws.id,
            recipientId: r.userId,
            type: 'replenishment_overdue',
            dedupeKey: `boardId=${board.id}`,
            payload: {
              boardId: board.id,
              boardName: board.name,
              daysOverdue,
            },
          })
          if (wasEmitted) localEmitted += 1
        }
      }

      return { localScanned, localEmitted }
    })

    scanned += inner.localScanned
    emitted += inner.localEmitted
  }

  return { scanned, emitted }
}

async function emitIfFresh(input: {
  tx: Parameters<typeof emitNotification>[0]['tx']
  workspaceId: string
  recipientId: string
  type: Parameters<typeof emitNotification>[0]['type']
  dedupeKey: string
  payload: Record<string, unknown>
}): Promise<boolean> {
  await setUserContext(input.tx, input.recipientId)
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS)
  const dedupeField = input.dedupeKey.split('=')[0]!
  const dedupeValue = input.dedupeKey.split('=').slice(1).join('=')

  const existing = await input.tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(
      eq(notifications.userId, input.recipientId),
      eq(notifications.type, input.type),
      sql`${notifications.payload}->>${dedupeField} = ${dedupeValue}`,
      gte(notifications.createdAt, since),
    ))
    .limit(1)
  if (existing.length > 0) return false

  await emitNotification({
    tx: input.tx,
    workspaceId: input.workspaceId,
    recipientId: input.recipientId,
    actorId: null,
    type: input.type,
    payload: input.payload,
  })
  return true
}

export async function checkSprintForecast(): Promise<FlowAlertResult> {
  const wsList = await useDB().select({ id: workspaces.id }).from(workspaces)

  let scanned = 0
  let emitted = 0

  for (const ws of wsList) {
    const candidates = await withTenant(ws.id, async (tx) => {
      const activeSprints = await tx
        .select({
          id: sprints.id,
          name: sprints.name,
          boardId: sprints.boardId,
          plannedEndAt: sprints.plannedEndAt,
        })
        .from(sprints)
        .where(and(
          eq(sprints.state, 'active'),
          isNotNull(sprints.plannedEndAt),
          gt(sprints.plannedEndAt, new Date()),
        ))

      const out: { sprint: typeof activeSprints[number]; tasksRemaining: number }[] = []
      for (const s of activeSprints) {
        const [agg] = await tx
          .select({ remaining: sql<number>`count(*)::int` })
          .from(sprintTasks)
          .innerJoin(tasks, eq(tasks.id, sprintTasks.taskId))
          .where(and(
            eq(sprintTasks.sprintId, s.id),
            isNull(tasks.closedAt),
          ))
        out.push({ sprint: s, tasksRemaining: agg?.remaining ?? 0 })
      }
      return out
    })

    if (candidates.length === 0) continue

    const recipients = await useDB()
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, ws.id),
        sql`${workspaceMembers.role} IN ('owner', 'admin', 'scrum_master')`,
      ))

    if (recipients.length === 0) continue

    for (const { sprint, tasksRemaining } of candidates) {
      scanned += 1
      if (tasksRemaining === 0) continue
      const msLeft = new Date(sprint.plannedEndAt!).getTime() - Date.now()
      const daysLeft = Math.ceil(msLeft / 86_400_000)
      if (daysLeft <= 0) continue

      const report = await computeMonteCarlo({
        workspaceId: ws.id,
        boardId: sprint.boardId,
        tasksRemaining,
        horizonDays: daysLeft,
        actorRole: 'viewer',
      })
      if (!report.ok) continue
      if (report.probability >= SPRINT_FORECAST_THRESHOLD) continue

      await withTenant(ws.id, async (tx) => {
        for (const r of recipients) {
          const wasEmitted = await emitIfFresh({
            tx,
            workspaceId: ws.id,
            recipientId: r.userId,
            type: 'sprint_forecast_drop',
            dedupeKey: `sprintId=${sprint.id}`,
            payload: {
              sprintId: sprint.id,
              boardId: sprint.boardId,
              sprintName: sprint.name,
              probability: report.probability,
              currentP85: report.percentileDays.p85,
              deadline: sprint.plannedEndAt!.toISOString(),
              daysLeft,
              tasksRemaining,
            },
          })
          if (wasEmitted) emitted += 1
        }
      })
    }
  }

  return { scanned, emitted }
}