import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  CfdReport,
  CycleTimeReport,
  ThroughputReport,
  MonteCarloReport,
  MonteCarloQuery,
  WipRecommendationsReport,
} from '#shared/types/analytics'

export function useAnalyticsApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const enabled = computed(() => !!unref(workspaceId) && !!unref(boardId))

  const cfd = useQuery({
    queryKey: computed(() => ['analytics', 'cfd', unref(workspaceId), unref(boardId)]),
    queryFn: () => $fetch<CfdReport>(apiRoutes.analyticsCfd(unref(workspaceId), unref(boardId))),
    enabled,
    staleTime: 60_000,
  })

  const cycleTime = useQuery({
    queryKey: computed(() => ['analytics', 'cycle-time', unref(workspaceId), unref(boardId)]),
    queryFn: () => $fetch<CycleTimeReport>(apiRoutes.analyticsCycleTime(unref(workspaceId), unref(boardId))),
    enabled,
    staleTime: 60_000,
  })

  const throughput = useQuery({
    queryKey: computed(() => ['analytics', 'throughput', unref(workspaceId), unref(boardId)]),
    queryFn: () => $fetch<ThroughputReport>(apiRoutes.analyticsThroughput(unref(workspaceId), unref(boardId))),
    enabled,
    staleTime: 60_000,
  })

  const wipRecommendations = useQuery({
    queryKey: computed(() => ['analytics', 'wip', unref(workspaceId), unref(boardId)]),
    queryFn: () => $fetch<WipRecommendationsReport>(apiRoutes.analyticsWipRecommendations(unref(workspaceId), unref(boardId))),
    enabled,
    staleTime: 60_000,
  })

  // Monte Carlo needs caller-driven params (tasksRemaining, horizonDays),
  // so it's exposed as a factory rather than a fixed query.
  function monteCarlo(params: MaybeRef<MonteCarloQuery>) {
    return useQuery({
      queryKey: computed(() => [
        'analytics', 'monte-carlo', unref(workspaceId), unref(boardId), unref(params),
      ]),
      queryFn: () => {
        const p = unref(params)
        const qs = new URLSearchParams({
          tasksRemaining: String(p.tasksRemaining),
          horizonDays: String(p.horizonDays),
          ...(p.iterations ? { iterations: String(p.iterations) } : {}),
        })
        return $fetch<MonteCarloReport>(
          `${apiRoutes.analyticsMonteCarlo(unref(workspaceId), unref(boardId))}?${qs}`,
        )
      },
      enabled,
      staleTime: 60_000,
    })
  }

  return { cfd, cycleTime, throughput, wipRecommendations, monteCarlo }
}