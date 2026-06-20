import { describe, it, expect } from 'vitest'
import type { Task } from '#shared/types/task'
import {
  startOfMonth, addMonths, sameDay, monthGridDays,
  dayKey, endOfDayIso, groupTasksByDay, filterTasks,
} from './calendar'

function task(p: Partial<Task>): Task {
  return { id: 'x', assigneeIds: [], dueDate: null, serviceClass: 'standard', ...p } as unknown as Task
}

describe('monthGridDays', () => {
  it('Dec 2025 starts on Mon Dec 1 and spans 42 days', () => {
    const g = monthGridDays(new Date(2025, 11, 1))
    expect(g).toHaveLength(42)
    expect(dayKey(g[0]!)).toBe('2025-12-1')
    expect(dayKey(g[31]!)).toBe('2026-1-1')
    expect(dayKey(g[41]!)).toBe('2026-1-11')
  })
  it('aligns a Sunday-starting month (Feb 2026) to the preceding Monday', () => {
    const g = monthGridDays(new Date(2026, 1, 1))
    expect(dayKey(g[0]!)).toBe('2026-1-26')
    expect(dayKey(g[6]!)).toBe('2026-2-1')
  })
  it('produces strictly consecutive days (no DST gaps/dupes)', () => {
    const g = monthGridDays(new Date(2026, 2, 1))
    for (let i = 1; i < g.length; i++) {
      const prev = new Date(g[i - 1]!.getFullYear(), g[i - 1]!.getMonth(), g[i - 1]!.getDate() + 1)
      expect(dayKey(g[i]!)).toBe(dayKey(prev))
    }
  })
})

describe('addMonths / startOfMonth / sameDay', () => {
  it('startOfMonth zeroes the day', () => {
    expect(dayKey(startOfMonth(new Date(2026, 5, 17)))).toBe('2026-6-1')
  })
  it('addMonths wraps the year', () => {
    expect(dayKey(addMonths(new Date(2025, 11, 1), 1))).toBe('2026-1-1')
  })
  it('sameDay ignores time', () => {
    expect(sameDay(new Date(2026, 0, 5, 9), new Date(2026, 0, 5, 23))).toBe(true)
    expect(sameDay(new Date(2026, 0, 5), new Date(2026, 0, 6))).toBe(false)
  })
})

describe('endOfDayIso', () => {
  it('formats end-of-day UTC ISO from a local date', () => {
    expect(endOfDayIso(new Date(2025, 11, 20))).toBe('2025-12-20T23:59:59.000Z')
  })
})

describe('groupTasksByDay', () => {
  it('buckets by due day and skips tasks without dueDate', () => {
    const a = task({ id: 'a', dueDate: '2025-12-20T23:59:59.000Z' })
    const b = task({ id: 'b', dueDate: '2025-12-20T23:59:59.000Z' })
    const c = task({ id: 'c', dueDate: null })
    const map = groupTasksByDay([a, b, c])
    expect(map.get(dayKey(new Date('2025-12-20T23:59:59.000Z')))?.map(t => t.id)).toEqual(['a', 'b'])
    expect([...map.values()].flat()).toHaveLength(2)
  })
})

describe('filterTasks', () => {
  const mine = task({ id: 'm', assigneeIds: ['u1'] })
  const other = task({ id: 'o', assigneeIds: ['u2'] })
  it('mine=true keeps only current user tasks', () => {
    expect(filterTasks([mine, other], { mine: true, assigneeIds: [] }, 'u1').map(t => t.id)).toEqual(['m'])
  })
  it('assigneeIds filters to selected people (OR)', () => {
    expect(filterTasks([mine, other], { mine: false, assigneeIds: ['u2'] }, 'u1').map(t => t.id)).toEqual(['o'])
  })
  it('no filters keeps all', () => {
    expect(filterTasks([mine, other], { mine: false, assigneeIds: [] }, 'u1')).toHaveLength(2)
  })
})
