import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { TaskDependenciesResponse } from '#shared/types/task'

export function useTaskDependenciesApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string | null>,
) {
  const qc = useQueryClient()

  const queryKey = computed(() => [
    'task-dependencies',
    unref(workspaceId),
    unref(boardId),
    unref(taskId),
  ])

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<TaskDependenciesResponse>(
        apiRoutes.taskDependencies(unref(workspaceId), unref(boardId), unref(taskId)!),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId)),
  })

  const add = useMutation({
    mutationFn: (blockerTaskId: string) =>
      $fetch(apiRoutes.taskDependencies(unref(workspaceId), unref(boardId), unref(taskId)!), {
        method: 'POST',
        body: { blockerTaskId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey.value })
      qc.invalidateQueries({
        queryKey: ['board-dependency-counts', unref(workspaceId), unref(boardId)],
      })
    },
  })

  const remove = useMutation({
    mutationFn: (blockerTaskId: string) =>
      $fetch(
        apiRoutes.taskDependency(
          unref(workspaceId),
          unref(boardId),
          unref(taskId)!,
          blockerTaskId,
        ),
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey.value })
      qc.invalidateQueries({
        queryKey: ['board-dependency-counts', unref(workspaceId), unref(boardId)],
      })
    },
  })

  return { list, add, remove }
}