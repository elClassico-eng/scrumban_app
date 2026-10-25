import type { MaybeRefOrGetter } from 'vue'
import type { BoardPulse } from '#shared/types/pulse'
import { nextActions } from '~/utils/next-actions'

export function useNextActions(
  workspaceId: MaybeRefOrGetter<string | null>,
  pulse: MaybeRefOrGetter<BoardPulse | null>,
) {
  const { current } = useCurrentWorkspace()
  const { counts, assigned } = useInboxCounts(workspaceId)
  const { list: mine } = useWorkspaceTasksApi(computed(() => toValue(workspaceId) ?? ''), { mine: true })
  const columns = useWorkspaceColumnsApi(workspaceId)
  const now = useNow({ interval: 60_000 })

  return computed(() => {
    const ws = toValue(workspaceId)
    if (!ws) return []
    const roleOf = new Map((columns.data.value?.columns ?? []).map(c => [c.id, c.columnRole]))
    return nextActions({
      now: now.value,
      workspaceId: ws,
      role: current.value?.role,
      pulse: toValue(pulse),
      inboxUnread: counts.data.value?.primary ?? 0,
      assigned: (assigned.data.value?.comments ?? []).map(c => ({
        id: c.id,
        taskId: c.taskId,
        boardId: c.boardId,
        taskTitle: c.taskTitle,
        authorName: displayName(c.author),
      })),
      myTasks: (mine.data.value?.tasks ?? []).map(task => ({ task, columnRole: roleOf.get(task.columnId) ?? null })),
    })
  })
}
