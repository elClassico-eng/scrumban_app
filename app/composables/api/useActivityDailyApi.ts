import { useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { TaskEventType } from '#shared/types/domain'
import { apiRoutes } from '~/routing'

export type ActivityDailyFilters = {
  from: string
  to: string
  tz: string
  board?: string
  actor?: string
}

export type ActivityDailyResponse = {
  buckets: { day: string, eventType: TaskEventType, count: number }[]
}

export function useActivityDailyApi(
  workspaceId: MaybeRefOrGetter<string>,
  filters: MaybeRefOrGetter<ActivityDailyFilters>,
) {
  const list = useQuery({
    queryKey: computed(() => ['activity-daily', toValue(workspaceId), toValue(filters)]),
    queryFn: () => {
      const f = toValue(filters)
      const qs = new URLSearchParams({ from: f.from, to: f.to, tz: f.tz })
      if (f.board) qs.set('board', f.board)
      if (f.actor) qs.set('actor', f.actor)
      return $fetch<ActivityDailyResponse>(
        `${apiRoutes.workspaceActivityDaily(toValue(workspaceId))}?${qs.toString()}`,
      )
    },
    enabled: computed(() => !!toValue(workspaceId)),
  })
  return { list }
}
