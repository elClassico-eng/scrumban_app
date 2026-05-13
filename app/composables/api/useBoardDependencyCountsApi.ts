import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

interface CountsResponse {
  counts: Array<{ taskId: string; blockerCount: number; blockedCount: number }>
}

export function useBoardDependencyCountsApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
) {
  const queryKey = computed(() => [
    'board-dependency-counts',
    unref(workspaceId),
    unref(boardId),
  ])

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<CountsResponse>(
        apiRoutes.boardDependencyCounts(unref(workspaceId), unref(boardId)),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId)),
  })

  const byTaskId = computed(() => {
    const map = new Map<string, { blockerCount: number; blockedCount: number }>()
    for (const c of list.data.value?.counts ?? []) {
      map.set(c.taskId, { blockerCount: c.blockerCount, blockedCount: c.blockedCount })
    }
    return map
  })

  return { list, byTaskId }
}