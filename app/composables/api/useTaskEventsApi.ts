import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { TaskEventsListResponse } from '#shared/types/task'

export function useTaskEventsApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string | null>,
) {
  const list = useQuery({
    queryKey: computed(() => ['task-events', unref(workspaceId), unref(boardId), unref(taskId)]),
    queryFn: () =>
      $fetch<TaskEventsListResponse>(
        apiRoutes.taskEvents(unref(workspaceId), unref(boardId), unref(taskId)!),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId)),
    staleTime: 30_000,
  })

  return { list }
}
