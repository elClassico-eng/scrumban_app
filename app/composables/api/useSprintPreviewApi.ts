import { useMutation } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { SprintPreviewReport } from '#shared/types/sprint'

export function useSprintPreviewApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const preview = useMutation({
    mutationFn: (input: {
      taskIds: string[]
      plannedStartAt?: string | null
      plannedEndAt?: string | null
    }) =>
      $fetch<SprintPreviewReport>(apiRoutes.sprintPreview(unref(workspaceId), unref(boardId)), {
        method: 'POST',
        body: input,
      }),
  })

  return { preview }
}
