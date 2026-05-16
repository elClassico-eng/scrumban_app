import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { ActivityListResponse } from '#shared/types/activity'

export interface ActivityFilters {
  board?: string
  actor?: string
  event?: string
  from?: string
  to?: string
}

export function useActivityApi(
  workspaceId: MaybeRef<string>,
  filters: MaybeRef<ActivityFilters>,
) {
  const list = useQuery({
    queryKey: computed(() => ['activity', unref(workspaceId), unref(filters)]),
    queryFn: () => {
      const f = unref(filters)
      const qs = new URLSearchParams()
      if (f.board) qs.set('board', f.board)
      if (f.actor) qs.set('actor', f.actor)
      if (f.event) qs.set('event', f.event)
      if (f.from) qs.set('from', f.from)
      if (f.to) qs.set('to', f.to)
      const tail = qs.toString()
      const url = apiRoutes.workspaceActivity(unref(workspaceId)) + (tail ? `?${tail}` : '')
      return $fetch<ActivityListResponse>(url)
    },
    enabled: computed(() => !!unref(workspaceId)),
    staleTime: 30_000,
  })

  return { list }
}