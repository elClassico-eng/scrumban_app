import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  ColumnsListResponse,
  ColumnResponse,
  CreateColumnInput,
  ReorderColumnsInput,
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

  const reorder = useMutation({
    mutationFn: (input: ReorderColumnsInput) =>
      $fetch<ColumnsListResponse>(apiRoutes.columnsReorder(unref(workspaceId), unref(boardId)), {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const remove = useMutation({
    mutationFn: (columnId: string) =>
      $fetch(apiRoutes.column(unref(workspaceId), unref(boardId), columnId), {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  return { list, create, reorder, remove }
}