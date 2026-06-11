import type { Task } from '#shared/types/task'
import type { BoardColumn as Column } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'

export type GroupBy = 'none' | 'assignee' | 'service_class' | 'epic'

export type ListGroup = {
  key: string
  title: string
  pillClass: string
  columnId: string | null
  limit: number | null
  doneGroup: boolean
  tasks: Task[]
}

const SERVICE_CLASS_PILL: Record<string, string> = {
  expedite: 'bg-red-500',
  fixed_date: 'bg-amber-500',
  standard: 'bg-slate-400 dark:bg-slate-500',
  intangible: 'bg-zinc-400 dark:bg-zinc-500',
}
const SERVICE_CLASS_ORDER = ['expedite', 'fixed_date', 'standard', 'intangible'] as const

export function buildChildrenByParent(tasks: Task[]): Map<string, Task[]> {
  const ids = new Set(tasks.map(t => t.id))
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    if (t.parentTaskId && ids.has(t.parentTaskId)) {
      const arr = map.get(t.parentTaskId) ?? []
      arr.push(t)
      map.set(t.parentTaskId, arr)
    }
  }
  for (const [k, arr] of map) map.set(k, [...arr].sort((a, b) => a.position - b.position))
  return map
}

export function buildTopLevel(tasks: Task[]): Task[] {
  const ids = new Set(tasks.map(t => t.id))
  return tasks.filter(t => !t.parentTaskId || !ids.has(t.parentTaskId))
}

export function buildGroups(
  topLevel: Task[],
  groupBy: GroupBy,
  columns: Column[],
  members: MemberView[],
  serviceClassLabel: (c: string) => string,
  columnPill: (c: Column) => string,
  memberLabel: (id: string) => string,
): ListGroup[] {
  const sorted = [...topLevel].sort((a, b) => a.position - b.position)

  if (groupBy === 'assignee') {
    const groups: ListGroup[] = []
    const none: Task[] = []
    const byUser = new Map<string, Task[]>()
    for (const t of sorted) {
      const ids = t.assigneeIds ?? []
      if (ids.length === 0) { none.push(t); continue }
      for (const id of ids) {
        const arr = byUser.get(id) ?? []
        arr.push(t)
        byUser.set(id, arr)
      }
    }
    for (const m of members) {
      const arr = byUser.get(m.userId)
      if (arr?.length) {
        groups.push({ key: `a-${m.userId}`, title: memberLabel(m.userId), pillClass: 'bg-zinc-500', columnId: null, limit: null, doneGroup: false, tasks: arr })
      }
    }
    if (none.length) groups.push({ key: 'a-none', title: 'Без исполнителя', pillClass: 'bg-zinc-400 dark:bg-zinc-600', columnId: null, limit: null, doneGroup: false, tasks: none })
    return groups
  }

  if (groupBy === 'service_class') {
    const groups: ListGroup[] = []
    for (const cls of SERVICE_CLASS_ORDER) {
      const arr = sorted.filter(t => t.serviceClass === cls)
      if (arr.length) groups.push({ key: `c-${cls}`, title: serviceClassLabel(cls), pillClass: SERVICE_CLASS_PILL[cls]!, columnId: null, limit: null, doneGroup: false, tasks: arr })
    }
    return groups
  }

  if (groupBy === 'epic') {
    const groups: ListGroup[] = []
    const epics = sorted.filter(t => t.isEpic)
    const none: Task[] = []
    const byEpic = new Map<string, Task[]>()
    for (const t of sorted) {
      if (t.isEpic) continue
      if (t.parentTaskId && epics.some(e => e.id === t.parentTaskId)) {
        const arr = byEpic.get(t.parentTaskId) ?? []
        arr.push(t)
        byEpic.set(t.parentTaskId, arr)
      } else { none.push(t) }
    }
    for (const e of epics) {
      const arr = byEpic.get(e.id) ?? []
      groups.push({ key: `e-${e.id}`, title: e.title, pillClass: 'bg-violet-500', columnId: null, limit: null, doneGroup: false, tasks: arr })
    }
    if (none.length) groups.push({ key: 'e-none', title: 'Без эпика', pillClass: 'bg-zinc-400 dark:bg-zinc-600', columnId: null, limit: null, doneGroup: false, tasks: none })
    return groups
  }

  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map(col => ({
      key: col.id,
      title: col.name,
      pillClass: columnPill(col),
      columnId: col.id,
      limit: col.wipLimit,
      doneGroup: col.columnRole === 'done',
      tasks: sorted.filter(t => t.columnId === col.id),
    }))
}
