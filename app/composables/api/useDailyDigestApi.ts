import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { DailyDigest } from '#shared/types/daily'

export function useDailyDigestApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  enabled: MaybeRef<boolean>,
) {
  const digest = useQuery({
    queryKey: computed(() => ['board-daily', unref(workspaceId), unref(boardId)]),
    queryFn: () => $fetch<DailyDigest>(apiRoutes.boardDaily(unref(workspaceId), unref(boardId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && unref(enabled)),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  return { digest }
}
