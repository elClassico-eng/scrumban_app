import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  BoardsListResponse,
  BoardResponse,
  CreateBoardInput,
  UpdateBoardInput,
  SleRecomputeResponse,
} from '#shared/types/board'

export function useBoardsApi(workspaceId: MaybeRef<string>) {
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: computed(() => ['boards', unref(workspaceId)]),
    queryFn: () => $fetch<BoardsListResponse>(apiRoutes.boards(unref(workspaceId))),
    enabled: computed(() => !!unref(workspaceId)),
  })

  const create = useMutation({
    mutationFn: (input: CreateBoardInput) =>
      $fetch<BoardResponse>(apiRoutes.boards(unref(workspaceId)), {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards', unref(workspaceId)] }),
  })

  const update = useMutation({
    mutationFn: ({ boardId, ...input }: { boardId: string } & UpdateBoardInput) =>
      $fetch<BoardResponse>(apiRoutes.board(unref(workspaceId), boardId), {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards', unref(workspaceId)] }),
  })

  const recomputeSLE = useMutation({
    mutationFn: (boardId: string) =>
      $fetch<SleRecomputeResponse>(apiRoutes.boardSleRecompute(unref(workspaceId), boardId), {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards', unref(workspaceId)] }),
  })

  const recordReplenishment = useMutation({
    mutationFn: (boardId: string) =>
      $fetch<BoardResponse>(apiRoutes.boardReplenishment(unref(workspaceId), boardId), {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards', unref(workspaceId)] }),
  })

  const remove = useMutation({
    mutationFn: (boardId: string) =>
      $fetch(apiRoutes.board(unref(workspaceId), boardId), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards', unref(workspaceId)] }),
  })

  return { list, create, update, recomputeSLE, recordReplenishment, remove }
}