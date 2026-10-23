import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

type WatchersResponse = { watchers: string[] }

export function useTaskWatchersApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  taskId: MaybeRef<string>,
) {
  const qc = useQueryClient()
  const auth = useAuthStore()
  const url = computed(() => apiRoutes.taskWatchers(unref(workspaceId), unref(boardId), unref(taskId)))
  const queryKey = computed(() => ['task-watchers', unref(workspaceId), unref(boardId), unref(taskId)])

  const list = useQuery({
    queryKey,
    queryFn: () => $fetch<WatchersResponse>(url.value),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(taskId)),
  })

  const watchers = computed(() => list.data.value?.watchers ?? [])
  const watching = computed(() => !!auth.user && watchers.value.includes(auth.user.id))

  const toggle = useMutation({
    mutationFn: (next: boolean) => $fetch(`${url.value}/me`, { method: next ? 'PUT' : 'DELETE' }),
    onMutate: async (next) => {
      const me = auth.user?.id
      if (!me) return
      await qc.cancelQueries({ queryKey: queryKey.value })
      const prev = qc.getQueryData<WatchersResponse>(queryKey.value)
      qc.setQueryData<WatchersResponse>(queryKey.value, {
        watchers: next ? [...new Set([...watchers.value, me])] : watchers.value.filter(id => id !== me),
      })
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey.value, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKey.value }),
  })

  return { list, watchers, watching, toggle }
}
