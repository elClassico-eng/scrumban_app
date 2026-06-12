import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { TasksListResponse } from '#shared/types/task'

export function useWorkspaceTasksApi(workspaceId: MaybeRef<string>) {
  const queryKey = computed(() => ['workspace-tasks', unref(workspaceId)])
  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<TasksListResponse>(apiRoutes.workspaceTasks(unref(workspaceId))),
    enabled: computed(() => !!unref(workspaceId)),
  })
  return { queryKey, list }
}
