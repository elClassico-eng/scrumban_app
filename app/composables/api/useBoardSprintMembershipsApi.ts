import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

interface Membership {
  sprintId: string
  taskId: string
}

interface Response {
  memberships: Membership[]
}

export function useBoardSprintMembershipsApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
) {
  const queryKey = computed(() => [
    'board-sprint-memberships',
    unref(workspaceId),
    unref(boardId),
  ])

  const list = useQuery({
    queryKey,
    queryFn: () =>
      $fetch<Response>(apiRoutes.boardSprintMemberships(unref(workspaceId), unref(boardId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId)),
  })

  // taskId → array of sprintIds. Tasks usually live in 0 or 1 sprint, but the
  // schema is M:N (carry-over case), so an array keeps callers honest.
  const sprintsByTaskId = computed(() => {
    const map = new Map<string, string[]>()
    for (const m of list.data.value?.memberships ?? []) {
      const arr = map.get(m.taskId) ?? []
      arr.push(m.sprintId)
      map.set(m.taskId, arr)
    }
    return map
  })

  return { list, sprintsByTaskId }
}
