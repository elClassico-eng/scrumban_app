import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  CreateChecklistItemInput,
  ReorderChecklistInput,
  TaskChecklistItemResponse,
  TaskChecklistListResponse,
  UpdateChecklistItemInput,
} from '#shared/types/checklist'

export function useTaskChecklistApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string>,
) {
  const qc = useQueryClient()

  const queryKey = computed(() => [
    'task-checklist',
    unref(workspaceId),
    unref(boardId),
    unref(taskId),
  ])

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<TaskChecklistListResponse>(
        apiRoutes.taskChecklist(unref(workspaceId), unref(boardId), unref(taskId)),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId)),
  })

  const create = useMutation({
    mutationFn: (input: CreateChecklistItemInput) =>
      $fetch<TaskChecklistItemResponse>(
        apiRoutes.taskChecklist(unref(workspaceId), unref(boardId), unref(taskId)),
        { method: 'POST', body: input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const update = useMutation({
    mutationFn: ({ itemId, ...patch }: { itemId: string } & UpdateChecklistItemInput) =>
      $fetch<TaskChecklistItemResponse>(
        apiRoutes.taskChecklistItem(
          unref(workspaceId),
          unref(boardId),
          unref(taskId),
          itemId,
        ),
        { method: 'PATCH', body: patch },
      ),
    onMutate: async ({ itemId, ...patch }) => {
      await qc.cancelQueries({ queryKey: queryKey.value })
      const prev = qc.getQueryData<TaskChecklistListResponse>(queryKey.value)
      if (prev) {
        qc.setQueryData<TaskChecklistListResponse>(queryKey.value, {
          items: prev.items.map(i => (i.id === itemId ? { ...i, ...patch } : i)),
        })
      }
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey.value, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const remove = useMutation({
    mutationFn: (itemId: string) =>
      $fetch(
        apiRoutes.taskChecklistItem(
          unref(workspaceId),
          unref(boardId),
          unref(taskId),
          itemId,
        ),
        { method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const reorder = useMutation({
    mutationFn: (input: ReorderChecklistInput) =>
      $fetch<TaskChecklistListResponse>(
        apiRoutes.taskChecklistReorder(unref(workspaceId), unref(boardId), unref(taskId)),
        { method: 'POST', body: input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  return { list, create, update, remove, reorder }
}