import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { apiRoutes } from '~/routing'
import type { AssignedComment } from '#shared/types/comment'
import type { NotificationListResponse, NotificationType, NotificationUnreadCountResponse } from '#shared/types/notification'

const PAGE = 30

export function useInboxApi(
  workspaceId: MaybeRefOrGetter<string | null>,
  filter: MaybeRefOrGetter<{ types?: NotificationType[], unreadOnly?: boolean }> = {},
) {
  const enabled = computed(() => !!toValue(workspaceId))

  const feed = useInfiniteQuery({
    queryKey: computed(() => ['notifications', 'inbox', toValue(workspaceId), toValue(filter)]),
    queryFn: ({ pageParam }) => {
      const f = toValue(filter)
      return $fetch<NotificationListResponse>(apiRoutes.notifications, {
        query: {
          workspaceId: toValue(workspaceId),
          types: f.types?.join(','),
          unread: f.unreadOnly || undefined,
          before: pageParam,
          limit: PAGE,
        },
      })
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.notifications.length === PAGE ? last.notifications.at(-1)!.createdAt : undefined),
    enabled,
  })

  const { unreadCount, assigned } = useInboxCounts(workspaceId)

  return { feed, unreadCount, assigned }
}

export function useInboxCounts(workspaceId: MaybeRefOrGetter<string | null>) {
  const enabled = computed(() => !!toValue(workspaceId))

  const unreadCount = useQuery({
    queryKey: computed(() => ['notifications', 'unread-count', toValue(workspaceId)]),
    queryFn: () => $fetch<NotificationUnreadCountResponse>(apiRoutes.notificationsUnreadCount, {
      query: { workspaceId: toValue(workspaceId) },
    }),
    enabled,
    staleTime: 15_000,
  })

  const assigned = useQuery({
    queryKey: computed(() => ['assigned-comments', toValue(workspaceId)]),
    queryFn: () => $fetch<{ comments: AssignedComment[] }>(apiRoutes.workspaceAssignedComments(toValue(workspaceId)!)),
    enabled,
    staleTime: 15_000,
  })

  return { unreadCount, assigned }
}

export function useInboxBadge(workspaceId: MaybeRefOrGetter<string | null>) {
  const { unreadCount, assigned } = useInboxCounts(workspaceId)
  return computed(() => (unreadCount.data.value?.count ?? 0) + (assigned.data.value?.comments.length ?? 0))
}
