import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

export type RetroCategory = 'went_well' | 'to_improve' | 'action_item'

export type RetroNote = {
  id: string
  sprintId: string
  category: RetroCategory
  body: string
  authorId: string | null
  taskId: string | null
  convertedTaskId: string | null
  isResolved: boolean
  createdAt: string
  updatedAt: string
}

export function useSprintRetroApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
) {
  const qc = useQueryClient()
  const key = computed(() => ['sprint-retro', unref(workspaceId), unref(boardId), unref(sprintId)])
  const invalidate = () => qc.invalidateQueries({ queryKey: key.value })

  const notes = useQuery({
    queryKey: key,
    queryFn: () =>
      $fetch<{ notes: RetroNote[] }>(
        apiRoutes.sprintRetro(unref(workspaceId), unref(boardId), unref(sprintId)),
      ).then(r => r.notes),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
  })

  const create = useMutation({
    mutationFn: (input: { category: RetroCategory; body: string; taskId?: string | null }) =>
      $fetch<{ note: RetroNote }>(
        apiRoutes.sprintRetro(unref(workspaceId), unref(boardId), unref(sprintId)),
        { method: 'POST', body: input },
      ),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: (input: { noteId: string; body?: string; category?: RetroCategory; isResolved?: boolean }) =>
      $fetch<{ note: RetroNote }>(
        apiRoutes.sprintRetroNote(unref(workspaceId), unref(boardId), unref(sprintId), input.noteId),
        { method: 'PATCH', body: { body: input.body, category: input.category, isResolved: input.isResolved } },
      ),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (noteId: string) =>
      $fetch<{ ok: boolean }>(
        apiRoutes.sprintRetroNote(unref(workspaceId), unref(boardId), unref(sprintId), noteId),
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })

  const convert = useMutation({
    mutationFn: (noteId: string) =>
      $fetch<{ note: RetroNote; taskId: string; addedToSprintId: string | null }>(
        apiRoutes.sprintRetroConvert(unref(workspaceId), unref(boardId), unref(sprintId), noteId),
        { method: 'POST' },
      ),
    onSuccess: invalidate,
  })

  return { notes, create, update, remove, convert }
}
