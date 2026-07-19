import { useDebounceFn, useEventSource } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

export function useSprintsRealtime(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()

  const url = computed(() => apiRoutes.boardStream(unref(workspaceId), unref(boardId)))

  const invalidate = useDebounceFn(() => {
    const ws = unref(workspaceId)
    const b = unref(boardId)
    qc.invalidateQueries({ queryKey: ['sprints', ws, b] })
    qc.invalidateQueries({ queryKey: ['sprint-activity', ws, b] })
    qc.invalidateQueries({ queryKey: ['board-sprint-memberships', ws, b] })
    qc.invalidateQueries({ queryKey: ['tasks', ws, b] })
  }, 250)

  const { data } = useEventSource(
    url,
    ['sprint.changed', 'task.created', 'task.moved', 'task.updated', 'task.deleted'],
    { autoReconnect: { retries: 3, delay: 2_000 } },
  )

  watch(data, (next) => {
    if (next == null) return
    invalidate()
  })
}
