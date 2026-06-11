import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  CreateTimeEntryInput,
  TaskTimeResponse,
  TimeEntryView,
  UpdateTimeEntryInput,
} from '#shared/types/time-entry'

export function useTaskTimeApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string>,
) {
  const qc = useQueryClient()

  const queryKey = computed(() => [
    'task-time',
    unref(workspaceId),
    unref(boardId),
    unref(taskId),
  ])

  function invalidate() {
    qc.invalidateQueries({ queryKey: queryKey.value })
    qc.invalidateQueries({ queryKey: ['tasks', unref(workspaceId), unref(boardId)] })
    qc.invalidateQueries({ queryKey: ['active-timer', unref(workspaceId)] })
  }

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<TaskTimeResponse>(
        apiRoutes.taskTime(unref(workspaceId), unref(boardId), unref(taskId)),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId)),
  })

  const start = useMutation({
    mutationFn: () =>
      $fetch<TimeEntryView>(
        apiRoutes.taskTimeStart(unref(workspaceId), unref(boardId), unref(taskId)),
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  })

  const stop = useMutation({
    mutationFn: () =>
      $fetch<TimeEntryView>(
        apiRoutes.taskTimeStop(unref(workspaceId), unref(boardId), unref(taskId)),
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  })

  const create = useMutation({
    mutationFn: (input: CreateTimeEntryInput) =>
      $fetch<TimeEntryView>(
        apiRoutes.taskTime(unref(workspaceId), unref(boardId), unref(taskId)),
        { method: 'POST', body: input },
      ),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ entryId, ...patch }: { entryId: string } & UpdateTimeEntryInput) =>
      $fetch<TimeEntryView>(
        apiRoutes.taskTimeItem(unref(workspaceId), unref(boardId), unref(taskId), entryId),
        { method: 'PATCH', body: patch },
      ),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (entryId: string) =>
      $fetch(
        apiRoutes.taskTimeItem(unref(workspaceId), unref(boardId), unref(taskId), entryId),
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })

  return { queryKey, list, start, stop, create, update, remove }
}
