import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { apiRoutes } from '~/routing'
import type { ColumnsListResponse } from '#shared/types/column'

export function useWorkspaceColumnsApi(workspaceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => ['workspace-columns', toValue(workspaceId)]),
    queryFn: () => $fetch<ColumnsListResponse>(apiRoutes.workspaceColumns(toValue(workspaceId)!)),
    enabled: computed(() => !!toValue(workspaceId)),
    staleTime: 60_000,
  })
}
