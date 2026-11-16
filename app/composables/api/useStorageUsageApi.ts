import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { StorageUsage } from '#shared/types/files'

export function useStorageUsageApi(workspaceId: MaybeRef<string | null>) {
  return useQuery({
    queryKey: computed(() => ['storage-usage', unref(workspaceId)]),
    queryFn: () => $fetch<StorageUsage>(apiRoutes.storageUsage(unref(workspaceId)!)),
    enabled: computed(() => !!unref(workspaceId)),
  })
}
