import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { AddTaskAssigneeInput, TaskAssigneesListResponse } from '#shared/types/assignee'

export function useTaskAssigneesApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string>,
  options?: { enabled?: MaybeRef<boolean> },
) {
  const qc = useQueryClient()

  const queryKey = computed(() => [
    'task-assignees',
    unref(workspaceId),
    unref(boardId),
    unref(taskId),
  ])

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<TaskAssigneesListResponse>(
        apiRoutes.taskAssignees(unref(workspaceId), unref(boardId), unref(taskId)),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId) && (unref(options?.enabled) ?? true)),
    staleTime: 15_000,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: queryKey.value })
    qc.invalidateQueries({ queryKey: ['tasks', unref(workspaceId), unref(boardId)] })
  }

  const add = useMutation({
    mutationFn: (input: AddTaskAssigneeInput) =>
      $fetch(
        apiRoutes.taskAssignees(unref(workspaceId), unref(boardId), unref(taskId)),
        { method: 'POST', body: input },
      ),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (userId: string) =>
      $fetch(
        apiRoutes.taskAssignee(unref(workspaceId), unref(boardId), unref(taskId), userId),
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })

  return { list, add, remove }
}
