import { useEventSource } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

export function useBoardSse(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()
  const toast = useToast()

  const url = computed(() =>
    apiRoutes.boardStream(unref(workspaceId), unref(boardId)),
  )

  const { data, event, status, close } = useEventSource(
    url,
    ['task.created', 'task.moved', 'task.updated', 'task.deleted'],
    { autoReconnect: { retries: 3, delay: 2_000 } },
  )

  watch(data, (next) => {
    if (next == null) return

    // Re-fetch authoritative state for any event.
    qc.invalidateQueries({
      queryKey: ['tasks', unref(workspaceId), unref(boardId)],
    })

    // Surface only events where the visual change isn't already obvious.
    // task.moved is shown via DnD; task.updated is visible inside the
    // drawer the user already has open. task.created and task.deleted
    // change the board's task SET, which is jarring without a heads-up
    // when triggered by another user.
    //
    // TODO: when backend BoardEvent payload gains actorId, suppress
    // toasts for events the current user triggered themselves.
    switch (event.value) {
      case 'task.created':
        toast.add({
          title: 'Появилась новая задача',
          icon: 'i-lucide-plus-circle',
          color: 'info',
        })
        break
      case 'task.deleted':
        toast.add({
          title: 'Задача удалена',
          icon: 'i-lucide-trash-2',
          color: 'warning',
        })
        break
    }
  })

  return { sseStatus: status, closeSse: close }
}