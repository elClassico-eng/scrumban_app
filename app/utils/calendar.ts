import type { Task } from '#shared/types/task'

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function monthGridDays(anchor: Date): Date[] {
  const first = startOfMonth(anchor)
  const shift = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) =>
    new Date(first.getFullYear(), first.getMonth(), 1 - shift + i))
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function endOfDayIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return new Date(`${y}-${m}-${day}T23:59:59Z`).toISOString()
}

export function groupTasksByDay(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.dueDate) continue
    const key = dayKey(new Date(t.dueDate))
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }
  return map
}

export type CalendarFilters = {
  mine: boolean
  assigneeIds: string[]
}

export function filterTasks(
  tasks: Task[],
  filters: CalendarFilters,
  currentUserId: string | null,
): Task[] {
  return tasks.filter((t) => {
    if (filters.mine && currentUserId && !t.assigneeIds.includes(currentUserId)) return false
    if (filters.assigneeIds.length > 0 && !t.assigneeIds.some(id => filters.assigneeIds.includes(id))) return false
    return true
  })
}
