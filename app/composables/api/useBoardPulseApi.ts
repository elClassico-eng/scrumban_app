import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { BoardPulse } from '#shared/types/pulse'

export function useBoardPulseApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string | null>,
  enabled: MaybeRef<boolean>,
) {
  const active = computed(() => !!unref(workspaceId) && !!unref(boardId) && unref(enabled))
  const pulse = useQuery({
    queryKey: computed(() => ['board-pulse', unref(workspaceId), unref(boardId)]),
    queryFn: () => $fetch<BoardPulse>(apiRoutes.boardPulse(unref(workspaceId), unref(boardId)!)),
    enabled: active,
    staleTime: 60_000,
    refetchInterval: computed(() => (active.value ? 60_000 : false)),
  })
  return { pulse }
}
