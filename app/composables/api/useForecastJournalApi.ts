import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { ForecastAccuracyResponse, SprintForecastHistoryResponse } from '#shared/types/forecast'
import { apiRoutes } from '~/routing'

export function useForecastJournalApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
) {
  function history(sprintId: MaybeRef<string>) {
    return useQuery({
      queryKey: computed(() => ['forecast-history', unref(workspaceId), unref(boardId), unref(sprintId)]),
      queryFn: () =>
        $fetch<SprintForecastHistoryResponse>(
          apiRoutes.sprintForecastHistory(unref(workspaceId), unref(boardId), unref(sprintId)),
        ),
      enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
    })
  }

  const accuracy = useQuery({
    queryKey: computed(() => ['forecast-accuracy', unref(workspaceId), unref(boardId)]),
    queryFn: () =>
      $fetch<ForecastAccuracyResponse>(
        apiRoutes.forecastAccuracy(unref(workspaceId), unref(boardId)),
      ),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId)),
  })

  return { history, accuracy }
}
