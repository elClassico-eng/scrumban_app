import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { SprintState } from '#shared/types/domain'
import { apiRoutes } from '~/routing'

export type TaskSprint = { id: string, name: string, state: SprintState }

export function useTaskSprintMembership(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string>,
) {
  const qc = useQueryClient()
  const { sprintsByTaskId } = useBoardSprintMembershipsApi(workspaceId, boardId)
  const { list: sprintsQuery } = useSprintsApi(workspaceId, boardId)

  const allSprints = computed<TaskSprint[]>(() =>
    (sprintsQuery.data.value?.sprints ?? []).map(s => ({ id: s.id, name: s.name, state: s.state })),
  )
  const taskSprintIds = computed(() => sprintsByTaskId.value.get(unref(taskId)) ?? [])

  const memberships = computed<TaskSprint[]>(() =>
    allSprints.value.filter(s => taskSprintIds.value.includes(s.id) && s.state !== 'closed'),
  )
  const addableSprints = computed<TaskSprint[]>(() =>
    allSprints.value.filter(s => s.state !== 'closed' && !taskSprintIds.value.includes(s.id)),
  )

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['board-sprint-memberships', unref(workspaceId), unref(boardId)] })
    qc.invalidateQueries({ queryKey: ['sprints', unref(workspaceId), unref(boardId)] })
  }

  const addTo = useMutation({
    mutationFn: (sprintId: string) =>
      $fetch(apiRoutes.sprintTasks(unref(workspaceId), unref(boardId), sprintId), {
        method: 'POST',
        body: { taskId: unref(taskId) },
      }),
    onSuccess: invalidate,
  })

  const removeFrom = useMutation({
    mutationFn: (sprintId: string) =>
      $fetch(apiRoutes.sprintTask(unref(workspaceId), unref(boardId), sprintId, unref(taskId)), {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  })

  return { memberships, addableSprints, addTo, removeFrom }
}