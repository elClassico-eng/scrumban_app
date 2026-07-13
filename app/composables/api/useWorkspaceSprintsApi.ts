import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { WorkspaceSprintsResponse } from '#shared/types/sprint'

export function useWorkspaceSprintsApi(workspaceId: MaybeRef<string>) {
  const enabled = computed(() => !!unref(workspaceId))

  const list = useQuery({
    queryKey: computed(() => ['workspace-sprints', unref(workspaceId)]),
    queryFn: () => $fetch<WorkspaceSprintsResponse>(apiRoutes.workspaceSprints(unref(workspaceId))),
    enabled,
    staleTime: 30_000,
  })

  return { list }
}
