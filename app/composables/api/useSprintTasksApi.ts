import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { AddTaskToSprintInput } from '#shared/types/sprint'

export function useSprintTasksApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
) {
  const qc = useQueryClient()

  const add = useMutation({
    mutationFn: (input: AddTaskToSprintInput) =>
      $fetch(apiRoutes.sprintTasks(unref(workspaceId), unref(boardId), unref(sprintId)), {
        method: 'POST',
        body: input,
      }),
    // Sprint membership changes both the sprint and the board's task view
    // (the task gets a sprint badge); invalidate both queries.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', unref(workspaceId), unref(boardId)] })
      qc.invalidateQueries({ queryKey: ['tasks', unref(workspaceId), unref(boardId)] })
    },
  })

  const remove = useMutation({
    mutationFn: (taskId: string) =>
      $fetch(
        apiRoutes.sprintTask(unref(workspaceId), unref(boardId), unref(sprintId), taskId),
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', unref(workspaceId), unref(boardId)] })
      qc.invalidateQueries({ queryKey: ['tasks', unref(workspaceId), unref(boardId)] })
    },
  })

  return { add, remove }
}