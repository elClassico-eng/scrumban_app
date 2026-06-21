import type { Task } from '#shared/types/task'
import type { NetworkTaskView } from '#shared/types/network'
import type { ServiceClass } from '#shared/types/domain'

const DAY_MS = 86_400_000

export type GanttRow = {
  taskId: string
  title: string
  serviceClass: ServiceClass
  start: Date
  end: Date
  slackEnd: Date | null
  critical: boolean
  dependsOn: string[]
}

export type GanttZoom = 'day' | 'week' | 'month'

export const PX_PER_DAY: Record<GanttZoom, number> = { day: 48, week: 16, month: 5 }

export type RowLayout = { taskId: string, y: number, x: number, width: number, slackWidth: number }
export type EdgeSegment = { x1: number, y1: number, x2: number, y2: number }

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

export function timeScale(rangeStart: Date, pxPerDay: number) {
  const startMs = rangeStart.getTime()
  return {
    xOf(date: Date): number {
      return ((date.getTime() - startMs) / DAY_MS) * pxPerDay
    },
  }
}

export function buildCpmRows(
  tasks: NetworkTaskView[],
  anchor: Date,
  serviceClassById: Record<string, ServiceClass>,
): GanttRow[] {
  return tasks.map(t => ({
    taskId: t.taskId,
    title: t.title,
    serviceClass: serviceClassById[t.taskId] ?? 'standard',
    start: addDays(anchor, t.earlyStartDays),
    end: addDays(anchor, t.earlyFinishDays),
    slackEnd: addDays(anchor, t.earlyFinishDays + t.slackDays),
    critical: t.critical,
    dependsOn: t.dependsOn,
  }))
}

export function buildFactRows(tasks: Task[], now: Date): GanttRow[] {
  return tasks.map(t => ({
    taskId: t.id,
    title: t.title,
    serviceClass: t.serviceClass,
    start: new Date(t.createdAt),
    end: t.closedAt ? new Date(t.closedAt) : now,
    slackEnd: null,
    critical: false,
    dependsOn: [],
  }))
}

export function rowsRange(rows: GanttRow[], extra: Date[]): { start: Date, end: Date } {
  const times: number[] = extra.map(d => d.getTime())
  for (const r of rows) {
    times.push(r.start.getTime(), r.end.getTime())
    if (r.slackEnd) times.push(r.slackEnd.getTime())
  }
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) }
}

export function layoutRows(
  rows: GanttRow[],
  scale: { xOf: (d: Date) => number },
  rowHeight: number,
): RowLayout[] {
  return rows.map((r, i) => {
    const x = scale.xOf(r.start)
    const width = Math.max(2, scale.xOf(r.end) - x)
    const slackWidth = r.slackEnd ? Math.max(0, scale.xOf(r.slackEnd) - scale.xOf(r.end)) : 0
    return { taskId: r.taskId, y: i * rowHeight + rowHeight / 2, x, width, slackWidth }
  })
}

export function edgeSegments(rows: GanttRow[], layout: RowLayout[]): EdgeSegment[] {
  const byId = new Map(layout.map(l => [l.taskId, l]))
  const segs: EdgeSegment[] = []
  for (const r of rows) {
    const to = byId.get(r.taskId)
    if (!to) continue
    for (const depId of r.dependsOn) {
      const from = byId.get(depId)
      if (!from) continue
      segs.push({ x1: from.x + from.width, y1: from.y, x2: to.x, y2: to.y })
    }
  }
  return segs
}

export function axisTicks(
  rangeStart: Date,
  rangeEnd: Date,
  zoom: GanttZoom,
): Array<{ x: number, label: string, major: boolean }> {
  const scale = timeScale(rangeStart, PX_PER_DAY[zoom])
  const out: Array<{ x: number, label: string, major: boolean }> = []
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  const endMs = rangeEnd.getTime()
  while (cursor.getTime() <= endMs) {
    const isMonthStart = cursor.getDate() === 1
    const isMonday = cursor.getDay() === 1
    if (zoom === 'day') {
      out.push({ x: scale.xOf(cursor), label: String(cursor.getDate()), major: isMonthStart })
    }
    else if (zoom === 'week' && (isMonday || isMonthStart)) {
      out.push({
        x: scale.xOf(cursor),
        label: isMonthStart ? cursor.toLocaleDateString('ru', { month: 'short' }) : String(cursor.getDate()),
        major: isMonthStart,
      })
    }
    else if (zoom === 'month' && isMonthStart) {
      out.push({ x: scale.xOf(cursor), label: cursor.toLocaleDateString('ru', { month: 'long' }), major: true })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}
