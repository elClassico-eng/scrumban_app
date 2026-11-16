import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { FileView } from '#shared/types/files'

export function useTaskFilesApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>, taskId: MaybeRef<string>) {
  const qc = useQueryClient()
  const queryKey = computed(() => ['task-files', unref(workspaceId), unref(boardId), unref(taskId)])
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKey.value })

  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<{ files: FileView[] }>(apiRoutes.taskFiles(unref(workspaceId), unref(boardId), unref(taskId))).then(r => r.files),
    enabled: computed(() => !!unref(taskId)),
  })

  const remove = useMutation({
    mutationFn: (fileId: string) => $fetch(`${apiRoutes.files(unref(workspaceId))}/${fileId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return { list, remove, invalidate }
}
