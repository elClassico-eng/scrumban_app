export type FlowEvent =
  | { at: Date; kind: 'column'; columnId: string }
  | { at: Date; kind: 'blocked' }
  | { at: Date; kind: 'unblocked' }

export type TaskFlow = {
  taskId: string
  totalHours: number
  activeHours: number
  queueHours: number
  blockedHours: number
  waitByColumn: Record<string, number>
}

export type FlowSummary = {
  sampleSize: number
  efficiency: number
  totalHours: number
  activeHours: number
  queueHours: number
  blockedHours: number
  waitByColumn: Record<string, number>
}

const HOUR_MS = 60 * 60 * 1000

export function computeTaskFlow(
  taskId: string,
  events: FlowEvent[],
  closedAt: Date,
  queueColumnIds: ReadonlySet<string>,
): TaskFlow {
  const sorted = [...events]
    .filter((e) => e.at.getTime() <= closedAt.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  const flow: TaskFlow = {
    taskId,
    totalHours: 0,
    activeHours: 0,
    queueHours: 0,
    blockedHours: 0,
    waitByColumn: {},
  }

  let columnId: string | null = null
  let isBlocked = false
  let cursor: Date | null = null

  const accumulate = (until: Date) => {
    if (columnId === null || cursor === null) return
    const hours = (until.getTime() - cursor.getTime()) / HOUR_MS
    if (hours <= 0) return
    flow.totalHours += hours
    if (queueColumnIds.has(columnId)) {
      flow.queueHours += hours
      flow.waitByColumn[columnId] = (flow.waitByColumn[columnId] ?? 0) + hours
    } else if (isBlocked) {
      flow.blockedHours += hours
      flow.waitByColumn[columnId] = (flow.waitByColumn[columnId] ?? 0) + hours
    } else {
      flow.activeHours += hours
    }
  }

  for (const event of sorted) {
    accumulate(event.at)
    if (event.kind === 'column') columnId = event.columnId
    else isBlocked = event.kind === 'blocked'
    cursor = event.at
  }
  accumulate(closedAt)

  return flow
}

export function summarizeFlow(flows: TaskFlow[]): FlowSummary {
  const summary: FlowSummary = {
    sampleSize: flows.length,
    efficiency: 0,
    totalHours: 0,
    activeHours: 0,
    queueHours: 0,
    blockedHours: 0,
    waitByColumn: {},
  }
  for (const f of flows) {
    summary.totalHours += f.totalHours
    summary.activeHours += f.activeHours
    summary.queueHours += f.queueHours
    summary.blockedHours += f.blockedHours
    for (const [columnId, hours] of Object.entries(f.waitByColumn)) {
      summary.waitByColumn[columnId] = (summary.waitByColumn[columnId] ?? 0) + hours
    }
  }
  summary.efficiency = summary.totalHours > 0 ? summary.activeHours / summary.totalHours : 0
  return summary
}
