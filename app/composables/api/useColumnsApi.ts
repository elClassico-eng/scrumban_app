import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  ColumnsListResponse,
  ColumnResponse,
  CreateColumnInput,
  ReorderColumnsInput,
  UpdateColumnInput,
} from '#shared/types/column'

export function useColumnsApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()

  const queryKey = computed(() => ['columns', unref(workspaceId), unref(boardId)])

  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<ColumnsListResponse>(apiRoutes.columns(unref(workspaceId), unref(boardId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId)),
  })

  const create = useMutation({
    mutationFn: (input: CreateColumnInput) =>
      $fetch<ColumnResponse>(apiRoutes.columns(unref(workspaceId), unref(boardId)), {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const update = useMutation({
    mutationFn: ({ columnId, ...patch }: { columnId: string } & UpdateColumnInput) =>
      $fetch<ColumnResponse>(apiRoutes.column(unref(workspaceId), unref(boardId), columnId), {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const reorder = useMutation({
    mutationFn: (input: ReorderColumnsInput) =>
      $fetch<ColumnsListResponse>(apiRoutes.columnsReorder(unref(workspaceId), unref(boardId)), {
        method: 'POST',
        body: input,
      }),
    // Optimistic: write the new order to cache immediately so DnD feels instant.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKey.value })
      const prev = qc.getQueryData<ColumnsListResponse>(queryKey.value)
      if (prev) {
        const byId = new Map(prev.columns.map(c => [c.id, c]))
        const reordered = input.orderedIds
          .map((id, idx) => {
            const c = byId.get(id)
            return c ? { ...c, position: idx } : null
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
        qc.setQueryData<ColumnsListResponse>(queryKey.value, { columns: reordered })
      }
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey.value, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const remove = useMutation({
    mutationFn: (columnId: string) =>
      $fetch(apiRoutes.column(unref(workspaceId), unref(boardId), columnId), {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  return { list, create, update, reorder, remove }
}