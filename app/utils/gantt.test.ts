import { describe, it, expect } from 'vitest'
import type { Task } from '#shared/types/task'
import type { NetworkTaskView } from '#shared/types/network'
import {
  addDays, timeScale, buildCpmRows, buildFactRows,
  rowsRange, layoutRows, edgeSegments, axisTicks, PX_PER_DAY,
} from './gantt'

const DAY = 86_400_000

function netTask(p: Partial<NetworkTaskView>): NetworkTaskView {
  return {
    taskId: 'x', title: 'X', storyPoints: null,
    estimate: { optimisticDays: 1, mostLikelyDays: 2, pessimisticDays: 3 },
    estimateSource: { kind: 'board_global', sampleCount: 5 },
    expectedDays: 2, earlyStartDays: 0, earlyFinishDays: 2,
    slackDays: 0, critical: false, dependsOn: [], ...p,
  }
}
function task(p: Partial<Task>): Task {
  return { id: 'x', title: 'X', serviceClass: 'standard', createdAt: '2025-12-01T00:00:00.000Z', closedAt: null, ...p } as unknown as Task
}

describe('addDays', () => {
  it('adds fractional days via elapsed time', () => {
    const base = new Date('2025-12-01T00:00:00.000Z')
    expect(addDays(base, 1.5).getTime()).toBe(base.getTime() + 1.5 * DAY)
  })
})

describe('timeScale', () => {
  it('maps the range start to x=0 and scales by pxPerDay', () => {
    const start = new Date('2025-12-01T00:00:00.000Z')
    const s = timeScale(start, 48)
    expect(s.xOf(start)).toBe(0)
    expect(s.xOf(addDays(start, 2))).toBe(96)
  })
})

describe('buildCpmRows', () => {
  it('places bars by early-start/finish and a slack tail to late-finish', () => {
    const anchor = new Date('2025-12-01T00:00:00.000Z')
    const t = netTask({ taskId: 'a', earlyStartDays: 1, earlyFinishDays: 3, slackDays: 2, critical: true, dependsOn: ['b'] })
    const [row] = buildCpmRows([t], anchor, { a: 'expedite' })
    expect(row!.start.getTime()).toBe(addDays(anchor, 1).getTime())
    expect(row!.end.getTime()).toBe(addDays(anchor, 3).getTime())
    expect(row!.slackEnd!.getTime()).toBe(addDays(anchor, 5).getTime())
    expect(row!.serviceClass).toBe('expedite')
    expect(row!.critical).toBe(true)
    expect(row!.dependsOn).toEqual(['b'])
  })
  it('falls back to standard service class when the task is not in the map', () => {
    const [row] = buildCpmRows([netTask({ taskId: 'z' })], new Date('2025-12-01T00:00:00.000Z'), {})
    expect(row!.serviceClass).toBe('standard')
  })
})

describe('buildFactRows', () => {
  it('uses createdAt to closedAt, or now when still open, with no slack/deps', () => {
    const now = new Date('2025-12-10T00:00:00.000Z')
    const closed = task({ id: 'c', createdAt: '2025-12-01T00:00:00.000Z', closedAt: '2025-12-04T00:00:00.000Z' })
    const open = task({ id: 'o', createdAt: '2025-12-02T00:00:00.000Z', closedAt: null })
    const rows = buildFactRows([closed, open], now)
    expect(rows[0]!.end.toISOString()).toBe('2025-12-04T00:00:00.000Z')
    expect(rows[1]!.end.getTime()).toBe(now.getTime())
    expect(rows[0]!.slackEnd).toBeNull()
    expect(rows[1]!.dependsOn).toEqual([])
  })
})

describe('rowsRange', () => {
  it('spans the min start and max end/slack including extra dates', () => {
    const anchor = new Date('2025-12-01T00:00:00.000Z')
    const rows = buildCpmRows([netTask({ earlyStartDays: 1, earlyFinishDays: 2, slackDays: 1 })], anchor, {})
    const today = addDays(anchor, 10)
    const r = rowsRange(rows, [today])
    expect(r.start.getTime()).toBe(addDays(anchor, 1).getTime())
    expect(r.end.getTime()).toBe(today.getTime())
  })
})

describe('layoutRows + edgeSegments', () => {
  it('computes bar geometry and connects dependency edges', () => {
    const anchor = new Date('2025-12-01T00:00:00.000Z')
    const rows = buildCpmRows([
      netTask({ taskId: 'a', earlyStartDays: 0, earlyFinishDays: 2, slackDays: 0 }),
      netTask({ taskId: 'b', earlyStartDays: 2, earlyFinishDays: 4, slackDays: 1, dependsOn: ['a'] }),
    ], anchor, {})
    const scale = timeScale(anchor, 10)
    const layout = layoutRows(rows, scale, 40)
    expect(layout[0]).toMatchObject({ taskId: 'a', y: 20, x: 0, width: 20, slackWidth: 0 })
    expect(layout[1]).toMatchObject({ taskId: 'b', y: 60, x: 20, width: 20, slackWidth: 10 })
    const segs = edgeSegments(rows, layout)
    expect(segs).toEqual([{ x1: 20, y1: 20, x2: 20, y2: 60 }])
  })
})

describe('axisTicks', () => {
  it('emits one tick per day at day zoom with px positions', () => {
    const ticks = axisTicks(new Date(2025, 11, 1), new Date(2025, 11, 3), 'day')
    expect(ticks.map(t => t.label)).toEqual(['1', '2', '3'])
    expect(ticks.map(t => t.x)).toEqual([0, PX_PER_DAY.day, PX_PER_DAY.day * 2])
  })
})
