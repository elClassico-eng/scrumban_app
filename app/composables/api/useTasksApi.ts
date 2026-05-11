import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  TasksListResponse,
  TaskResponse,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
} from '#shared/types/task'

export function useTasksApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()

  const queryKey = computed(() => ['tasks', unref(workspaceId), unref(boardId)])

  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<TasksListResponse>(apiRoutes.tasks(unref(workspaceId), unref(boardId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId)),
  })

  const create = useMutation({
    mutationFn: (input: CreateTaskInput) =>
      $fetch<TaskResponse>(apiRoutes.tasks(unref(workspaceId), unref(boardId)), {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const update = useMutation({
    mutationFn: ({ taskId, ...input }: { taskId: string } & UpdateTaskInput) =>
      $fetch<TaskResponse>(apiRoutes.task(unref(workspaceId), unref(boardId), taskId), {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const remove = useMutation({
    mutationFn: (taskId: string) =>
      $fetch(apiRoutes.task(unref(workspaceId), unref(boardId), taskId), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const move = useMutation({
    mutationFn: ({ taskId, ...input }: { taskId: string } & MoveTaskInput) =>
      $fetch<TaskResponse>(apiRoutes.taskMove(unref(workspaceId), unref(boardId), taskId), {
        method: 'POST',
        body: input,
      }),
  })

  return { queryKey, list, create, update, remove, move }
}