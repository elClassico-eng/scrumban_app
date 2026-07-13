import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { SprintActivityResponse } from '#shared/types/sprint-activity'

export function useSprintActivityApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const activity = useQuery({
    queryKey: computed(() => ['sprint-activity', unref(workspaceId), unref(boardId)]),
    queryFn: () =>
      $fetch<SprintActivityResponse>(apiRoutes.boardSprintActivity(unref(workspaceId), unref(boardId)))
        .then(r => r.items),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId)),
    staleTime: 30_000,
  })

  return { activity }
}
