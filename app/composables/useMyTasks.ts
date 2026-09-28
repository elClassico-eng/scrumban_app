import type { MaybeRefOrGetter } from 'vue'
import type { Task } from '#shared/types/task'

export function useMyTasks(
  tasks: MaybeRefOrGetter<Task[]>,
  userId: MaybeRefOrGetter<string | null>,
) {
  const mine = computed(() => {
    const id = toValue(userId)
    if (!id) return []
    return toValue(tasks).filter(t => t.assigneeIds.includes(id) || t.assigneeId === id)
  })

  const open = computed(() => mine.value.filter(t => !t.closedAt))
  const attention = computed(() => buildAttention(open.value))
  const overdue = computed(() => attention.value.filter(i => i.kind === 'overdue').length)

  const closedThisWeek = computed(() => {
    const since = Date.now() - 7 * 86_400_000
    return mine.value.filter(t => t.closedAt && new Date(t.closedAt).getTime() >= since).length
  })

  return { mine, open, attention, overdue, closedThisWeek }
}
