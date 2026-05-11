import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  SprintsListResponse,
  SprintResponse,
  CreateSprintInput,
  UpdateSprintInput,
} from '#shared/types/sprint'

export function useSprintsApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()

  const queryKey = computed(() => ['sprints', unref(workspaceId), unref(boardId)])

  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<SprintsListResponse>(apiRoutes.sprints(unref(workspaceId), unref(boardId))),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId)),
  })

  const create = useMutation({
    mutationFn: (input: CreateSprintInput) =>
      $fetch<SprintResponse>(apiRoutes.sprints(unref(workspaceId), unref(boardId)), {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const update = useMutation({
    mutationFn: ({ sprintId, ...input }: { sprintId: string } & UpdateSprintInput) =>
      $fetch<SprintResponse>(apiRoutes.sprint(unref(workspaceId), unref(boardId), sprintId), {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const remove = useMutation({
    mutationFn: (sprintId: string) =>
      $fetch(apiRoutes.sprint(unref(workspaceId), unref(boardId), sprintId), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const start = useMutation({
    mutationFn: (sprintId: string) =>
      $fetch<SprintResponse>(apiRoutes.sprintStart(unref(workspaceId), unref(boardId), sprintId), {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  const close = useMutation({
    mutationFn: (sprintId: string) =>
      $fetch<SprintResponse>(apiRoutes.sprintClose(unref(workspaceId), unref(boardId), sprintId), {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  return { queryKey, list, create, update, remove, start, close }
}