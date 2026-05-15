import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { TasksListResponse } from '#shared/types/task'

export function useTaskSubtasksApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string>,
) {
  const list = useQuery({
    queryKey: computed(() => ['task-subtasks', unref(workspaceId), unref(boardId), unref(taskId)]),
    queryFn: () =>
      $fetch<TasksListResponse>(apiRoutes.taskSubtasks(unref(workspaceId), unref(boardId), unref(taskId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId)),
    staleTime: 15_000,
  })

  return { list }
}
