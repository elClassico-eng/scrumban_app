import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { BoardFeedView, FeedEvent } from '#shared/types/integrations'

export function useBoardFeedsApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>, enabled: MaybeRef<boolean>) {
  const qc = useQueryClient()
  const url = computed(() => apiRoutes.boardFeeds(unref(workspaceId), unref(boardId)))
  const queryKey = computed(() => ['board-feeds', unref(workspaceId), unref(boardId)])
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKey.value })

  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<{ feeds: BoardFeedView[] }>(url.value).then(r => r.feeds),
    enabled: computed(() => unref(enabled)),
  })

  const create = useMutation({
    mutationFn: (body: { chatId: string, events: FeedEvent[], standupTime: string | null }) => $fetch(url.value, { method: 'POST', body }),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string, events?: FeedEvent[], standupTime?: string | null }) =>
      $fetch(`${url.value}/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => $fetch(`${url.value}/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const test = useMutation({
    mutationFn: (id: string) => $fetch(`${url.value}/${id}/test`, { method: 'POST' }),
  })

  return { list, create, update, remove, test }
}
