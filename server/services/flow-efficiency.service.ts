import { sql } from 'drizzle-orm'
import type { WorkspaceMemberRole } from '../db/schema'
import type { FlowEfficiencyReport } from '#shared/types/analytics'
import { withTenant } from '../utils/db'
import { requireMinRole } from '../utils/rbac'
import { computeTaskFlow, summarizeFlow, type FlowEvent } from '../utils/flow-efficiency'

const MIN_SAMPLES = 5

type EventRow = {
  taskId: string
  eventType: string
  toColumnId: string | null
  createdAt: Date | string
  closedAt: Date | string
}

type ColumnRow = {
  id: string
  name: string
  columnRole: string
  isQueue: boolean
}

export async function computeFlowEfficiency(input: {
  workspaceId: string
  boardId: string
  from: Date
  to: Date
  actorRole: WorkspaceMemberRole
}): Promise<FlowEfficiencyReport> {
  requireMinRole(input.actorRole, 'viewer')
  const range = { from: input.from.toISOString(), to: input.to.toISOString() }

  const { events, columns } = await withTenant(input.workspaceId, async (tx) => {
    const events = (await tx.execute<EventRow>(sql`
      WITH closed AS (
        SELECT DISTINCT ON (e.task_id) e.task_id, e.created_at AS closed_at
        FROM task_events e
        JOIN tasks t ON t.id = e.task_id
        WHERE e.event_type = 'task_closed'
          AND t.board_id = ${input.boardId}
          AND e.created_at >= ${range.from}::timestamptz
          AND e.created_at <= ${range.to}::timestamptz
        ORDER BY e.task_id, e.created_at DESC
      )
      SELECT
        e.task_id      AS "taskId",
        e.event_type   AS "eventType",
        e.to_column_id AS "toColumnId",
        e.created_at   AS "createdAt",
        c.closed_at    AS "closedAt"
      FROM task_events e
      JOIN closed c ON c.task_id = e.task_id
      WHERE e.event_type IN (
        'task_created', 'task_moved', 'task_closed', 'task_reopened',
        'task_blocked', 'task_unblocked'
      )
      ORDER BY e.task_id, e.created_at
    `)) as unknown as EventRow[]
    const columns = (await tx.execute<ColumnRow>(sql`
      SELECT id, name, column_role AS "columnRole", is_queue AS "isQueue"
      FROM board_columns
      WHERE board_id = ${input.boardId}
        AND column_role NOT IN ('done', 'archived')
      ORDER BY position
    `)) as unknown as ColumnRow[]
    return { events, columns }
  })

  const queueIds = new Set(columns.filter((c) => c.isQueue).map((c) => c.id))
  const byTask = new Map<string, { events: FlowEvent[]; closedAt: Date }>()
  for (const row of events) {
    const entry = byTask.get(row.taskId) ?? { events: [], closedAt: new Date(row.closedAt) }
    const at = new Date(row.createdAt)
    if (row.eventType === 'task_blocked') entry.events.push({ at, kind: 'blocked' })
    else if (row.eventType === 'task_unblocked') entry.events.push({ at, kind: 'unblocked' })
    else if (row.toColumnId) entry.events.push({ at, kind: 'column', columnId: row.toColumnId })
    byTask.set(row.taskId, entry)
  }

  const flows = Array.from(byTask, ([taskId, t]) =>
    computeTaskFlow(taskId, t.events, t.closedAt, queueIds),
  )
  if (flows.length < MIN_SAMPLES) {
    return {
      ...range,
      ok: false,
      reason: 'insufficient_data',
      sampleSize: flows.length,
      requiredSamples: MIN_SAMPLES,
    }
  }

  const summary = summarizeFlow(flows)
  const waitTotal = summary.queueHours + summary.blockedHours
  return {
    ...range,
    ok: true,
    sampleSize: summary.sampleSize,
    efficiency: summary.efficiency,
    totalHours: summary.totalHours,
    activeHours: summary.activeHours,
    queueHours: summary.queueHours,
    blockedHours: summary.blockedHours,
    columns: columns.map((c) => {
      const waitHours = summary.waitByColumn[c.id] ?? 0
      return {
        columnId: c.id,
        name: c.name,
        columnRole: c.columnRole,
        isQueue: c.isQueue,
        waitHours,
        share: waitTotal > 0 ? waitHours / waitTotal : 0,
      }
    }),
  }
}
