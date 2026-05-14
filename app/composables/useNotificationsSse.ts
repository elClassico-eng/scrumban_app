import { useEventSource } from '@vueuse/core'
import { useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'

export function useNotificationsSse() {
  const qc = useQueryClient()

  const { data, status, close } = useEventSource(
    apiRoutes.notificationsStream,
    ['notification.created'],
    { autoReconnect: { retries: 3, delay: 2_000 } },
  )

  watch(data, (next) => {
    if (next == null) return
    qc.invalidateQueries({ queryKey: ['notifications'] })
  })

  return { sseStatus: status, closeSse: close }
}
