import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { SprintNetworkReport } from '#shared/types/network'

export function useSprintNetworkApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
) {
  const report = useQuery({
    queryKey: computed(() => ['sprint-network', unref(workspaceId), unref(boardId), unref(sprintId)]),
    queryFn: () =>
      $fetch<SprintNetworkReport>(apiRoutes.sprintNetwork(unref(workspaceId), unref(boardId), unref(sprintId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
    staleTime: 30_000,
  })

  return { report }
}
