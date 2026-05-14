import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type {
  NotificationListResponse,
  NotificationResponse,
  NotificationUnreadCountResponse,
} from '#shared/types/notification'

export function useNotificationsApi() {
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: () => $fetch<NotificationListResponse>(apiRoutes.notifications),
    staleTime: 15_000,
  })

  const unreadCount = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => $fetch<NotificationUnreadCountResponse>(apiRoutes.notificationsUnreadCount),
    staleTime: 15_000,
  })

  const markRead = useMutation({
    mutationFn: (id: string) =>
      $fetch<NotificationResponse>(apiRoutes.notificationRead(id), { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: (workspaceId?: string) =>
      $fetch<{ count: number }>(apiRoutes.notificationsReadAll, {
        method: 'POST',
        body: workspaceId ? { workspaceId } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return { list, unreadCount, markRead, markAllRead }
}
