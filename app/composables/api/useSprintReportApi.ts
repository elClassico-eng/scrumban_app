import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { SprintReportResponse } from '#shared/types/sprint-report'

export function useSprintReportApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
) {
  const qc = useQueryClient()
  const key = computed(() => ['sprint-report', unref(workspaceId), unref(boardId), unref(sprintId)])

  const report = useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await $fetch<SprintReportResponse>(
          apiRoutes.sprintReport(unref(workspaceId), unref(boardId), unref(sprintId)),
        )
      }
      catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404) return null
        throw err
      }
    },
    retry: false,
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
  })

  const generate = useMutation({
    mutationFn: () =>
      $fetch<SprintReportResponse>(
        apiRoutes.sprintReportGenerate(unref(workspaceId), unref(boardId), unref(sprintId)),
        { method: 'POST' },
      ),
    onSuccess: (data) => {
      qc.setQueryData(key.value, data)
    },
  })

  return { report, generate }
}
