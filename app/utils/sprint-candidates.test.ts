import { describe, it, expect } from 'vitest'
import type { Task } from '#shared/types/task'
import type { BoardColumn, ColumnRole } from '#shared/types/column'
import { terminalColumnIds, filterSprintCandidates } from './sprint-candidates'

function task(p: Partial<Task>): Task {
  return { id: 'x', columnId: 'c-backlog', closedAt: null, ...p } as unknown as Task
}
function col(id: string, columnRole: ColumnRole): BoardColumn {
  return { id, columnRole } as unknown as BoardColumn
}

describe('terminalColumnIds', () => {
  it('collects done and archived column ids only', () => {
    const cols = [col('c1', 'backlog'), col('c2', 'done'), col('c3', 'archived'), col('c4', 'in_progress')]
    expect([...terminalColumnIds(cols)].sort()).toEqual(['c2', 'c3'])
  })
})

describe('filterSprintCandidates', () => {
  const cols = [col('c-backlog', 'backlog'), col('c-done', 'done'), col('c-arch', 'archived')]
  const terminal = terminalColumnIds(cols)

  it('excludes archived and done tasks even when closedAt is null', () => {
    const tasks = [
      task({ id: 'a', columnId: 'c-backlog' }),
      task({ id: 'b', columnId: 'c-done', closedAt: null }),
      task({ id: 'c', columnId: 'c-arch', closedAt: null }),
    ]
    const out = filterSprintCandidates(tasks, { excludeTaskIds: new Set(), terminalColumnIds: terminal })
    expect(out.map(t => t.id)).toEqual(['a'])
  })

  it('excludes already-assigned and closed tasks', () => {
    const tasks = [
      task({ id: 'a', columnId: 'c-backlog' }),
      task({ id: 'b', columnId: 'c-backlog' }),
      task({ id: 'c', columnId: 'c-backlog', closedAt: '2025-01-01T00:00:00.000Z' }),
    ]
    const out = filterSprintCandidates(tasks, { excludeTaskIds: new Set(['b']), terminalColumnIds: terminal })
    expect(out.map(t => t.id)).toEqual(['a'])
  })
})
