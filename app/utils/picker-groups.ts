import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'

export function buildColumnGroups<TItem>(
  columns: BoardColumn[],
  tasks: Task[],
  mapItem: (task: Task, column: BoardColumn) => TItem,
): Array<{ id: string; label: string; items: TItem[] }> {
  const byColumn = new Map<string, Task[]>()
  for (const t of tasks) {
    const arr = byColumn.get(t.columnId) ?? []
    arr.push(t)
    byColumn.set(t.columnId, arr)
  }
  const sorted = [...columns].sort((a, b) => a.position - b.position)
  const groups: Array<{ id: string; label: string; items: TItem[] }> = []
  for (const col of sorted) {
    const colTasks = (byColumn.get(col.id) ?? []).sort((a, b) => a.position - b.position)
    if (colTasks.length === 0) continue
    groups.push({
      id: col.id,
      label: col.name,
      items: colTasks.map(t => mapItem(t, col)),
    })
  }
  return groups
}