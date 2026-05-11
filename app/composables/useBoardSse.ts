import { useEventSource } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

// Subscribes to /api/workspaces/:id/boards/:boardId/stream and invalidates
// the tasks query for this board whenever the server publishes a board
// event. Backend emits four event names: task.created / task.moved /
// task.updated / task.deleted; we invalidate uniformly because any of
// them changes the tasks list shape that the board renders from.
export function useBoardSse(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()

  const url = computed(() =>
    apiRoutes.boardStream(unref(workspaceId), unref(boardId)),
  )

  const { data, status, close } = useEventSource(
    url,
    ['task.created', 'task.moved', 'task.updated', 'task.deleted'],
    { autoReconnect: { retries: 3, delay: 2_000 } },
  )

  watch(data, (next) => {
    if (next == null) return
    qc.invalidateQueries({
      queryKey: ['tasks', unref(workspaceId), unref(boardId)],
    })
  })

  return { sseStatus: status, closeSse: close }
}
