import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { AddTaskToSprintInput } from '#shared/types/sprint'

interface SprintTaskRef {
  taskId: string
  addedAt: string
}

export function useSprintTasksApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
) {
  const qc = useQueryClient()

  const queryKey = computed(() => [
    'sprint-tasks',
    unref(workspaceId),
    unref(boardId),
    unref(sprintId),
  ])

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<{ items: SprintTaskRef[] }>(
        apiRoutes.sprintTasks(unref(workspaceId), unref(boardId), unref(sprintId)),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: queryKey.value })
    qc.invalidateQueries({
      queryKey: ['board-sprint-memberships', unref(workspaceId), unref(boardId)],
    })
    qc.invalidateQueries({ queryKey: ['sprints', unref(workspaceId), unref(boardId)] })
  }

  const add = useMutation({
    mutationFn: (input: AddTaskToSprintInput) =>
      $fetch(apiRoutes.sprintTasks(unref(workspaceId), unref(boardId), unref(sprintId)), {
        method: 'POST',
        body: input,
      }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (taskId: string) =>
      $fetch(
        apiRoutes.sprintTask(unref(workspaceId), unref(boardId), unref(sprintId), taskId),
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })

  return { list, add, remove }
}