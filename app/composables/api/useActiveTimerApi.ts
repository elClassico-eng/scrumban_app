import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { ActiveTimerResponse } from '#shared/types/time-entry'

export function useActiveTimerApi(workspaceId: MaybeRef<string>) {
  const queryKey = computed(() => ['active-timer', unref(workspaceId)])

  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<ActiveTimerResponse>(apiRoutes.activeTimer(unref(workspaceId))),
    enabled: computed(() => !!unref(workspaceId)),
    staleTime: 5_000,
  })

  return { queryKey, list }
}
