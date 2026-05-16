import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { BurndownReport } from '#shared/types/sprint'

export function useSprintBurndownApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
) {
  const list = useQuery({
    queryKey: computed(() => ['sprint-burndown', unref(workspaceId), unref(boardId), unref(sprintId)]),
    queryFn: () =>
      $fetch<BurndownReport>(apiRoutes.sprintBurndown(unref(workspaceId), unref(boardId), unref(sprintId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
    staleTime: 30_000,
  })

  return { list }
}
