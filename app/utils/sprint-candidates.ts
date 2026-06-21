import type { Task } from '#shared/types/task'
import type { BoardColumn, ColumnRole } from '#shared/types/column'

const TERMINAL_ROLES: ColumnRole[] = ['done', 'archived']

export function terminalColumnIds(columns: BoardColumn[]): Set<string> {
  return new Set(columns.filter(c => TERMINAL_ROLES.includes(c.columnRole)).map(c => c.id))
}

export function filterSprintCandidates(
  tasks: Task[],
  opts: { excludeTaskIds: Set<string>, terminalColumnIds: Set<string> },
): Task[] {
  return tasks.filter((t) => {
    if (opts.excludeTaskIds.has(t.id)) return false
    if (opts.terminalColumnIds.has(t.columnId)) return false
    if (t.closedAt) return false
    return true
  })
}
