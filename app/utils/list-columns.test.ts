import { describe, expect, it } from 'vitest'
import type { Task } from '#shared/types/task'
import { listColumnsTemplate, visibleColumns } from './list-columns'

const task = (over: Partial<Task>): Task => ({ id: 't1', checklistTotal: 0, checklistDone: 0, timeSpentSeconds: 0, ...over } as Task)

describe('visibleColumns', () => {
  it('hides everything when all rows are empty', () => {
    expect(visibleColumns([task({})], new Set())).toEqual(new Set())
  })
  it('shows a column when at least one row has a value', () => {
    const v = visibleColumns([task({}), task({ id: 't2', checklistTotal: 3 })], new Set(['t1']))
    expect(v).toEqual(new Set(['sprint', 'checklist']))
  })
  it('builds the grid template in column order', () => {
    expect(listColumnsTemplate(new Set(['time']))).toBe('minmax(0,1fr) 96px 132px 138px 52px 86px')
  })
})
