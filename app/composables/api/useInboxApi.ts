import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { apiRoutes } from '~/routing'
import type { AssignedComment } from '#shared/types/comment'
import type { NotificationListResponse, NotificationType } from '#shared/types/notification'
import type { InboxView } from '#shared/utils/notification-category'

const PAGE = 50

export type InboxCounts = { primary: number, flow: number, later: number }
export type InboxPatch = { read?: boolean, cleared?: boolean, snoozedUntil?: string | null }

export function useInboxApi(
  workspaceId: MaybeRefOrGetter<string | null>,
  filter: MaybeRefOrGetter<{ view: InboxView, types?: NotificationType[], unreadOnly?: boolean }>,
) {
  const qc = useQueryClient()
  const enabled = computed(() => !!toValue(workspaceId))
  const feedKey = computed(() => ['notifications', 'inbox', toValue(workspaceId), toValue(filter)])

  const feed = useInfiniteQuery({
    queryKey: feedKey,
    queryFn: ({ pageParam }) => {
      const f = toValue(filter)
      return $fetch<NotificationListResponse>(apiRoutes.notifications, {
        query: {
          workspaceId: toValue(workspaceId),
          view: f.view,
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

  const { counts, assigned } = useInboxCounts(workspaceId)

  function dropFromFeed(ids: string[]) {
    const gone = new Set(ids)
    qc.setQueryData<InfiniteData<NotificationListResponse>>(feedKey.value, data => data && {
      ...data,
      pages: data.pages.map(p => ({ notifications: p.notifications.filter(n => !gone.has(n.id)) })),
    })
  }

  function markInFeed(ids: string[], read: boolean) {
    const hit = new Set(ids)
    const readAt = read ? new Date().toISOString() : null
    qc.setQueryData<InfiniteData<NotificationListResponse>>(feedKey.value, data => data && {
      ...data,
      pages: data.pages.map(p => ({ notifications: p.notifications.map(n => (hit.has(n.id) ? { ...n, readAt } : n)) })),
    })
  }

  const update = useMutation({
    mutationFn: ({ ids, ...patch }: { ids: string[] } & InboxPatch) =>
      $fetch(apiRoutes.notifications, { method: 'PATCH', body: { ids, ...patch } }),
    onMutate: ({ ids, ...patch }) => {
      if (patch.read !== undefined && patch.cleared === undefined && patch.snoozedUntil === undefined) markInFeed(ids, patch.read)
      else dropFromFeed(ids)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const clearAll = useMutation({
    mutationFn: (view: 'primary' | 'flow') =>
      $fetch(apiRoutes.notificationsClearAll, { method: 'POST', body: { workspaceId: toValue(workspaceId), view } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return { feed, counts, assigned, update, clearAll }
}

export function useInboxCounts(workspaceId: MaybeRefOrGetter<string | null>) {
  const enabled = computed(() => !!toValue(workspaceId))

  const counts = useQuery({
    queryKey: computed(() => ['notifications', 'counts', toValue(workspaceId)]),
    queryFn: () => $fetch<InboxCounts>(apiRoutes.notificationsCounts, { query: { workspaceId: toValue(workspaceId) } }),
    enabled,
    staleTime: 15_000,
  })

  const assigned = useQuery({
    queryKey: computed(() => ['assigned-comments', toValue(workspaceId)]),
    queryFn: () => $fetch<{ comments: AssignedComment[] }>(apiRoutes.workspaceAssignedComments(toValue(workspaceId)!)),
    enabled,
    staleTime: 15_000,
  })

  return { counts, assigned }
}

export function useInboxBadge(workspaceId: MaybeRefOrGetter<string | null>) {
  const { counts, assigned } = useInboxCounts(workspaceId)
  return computed(() => (counts.data.value?.primary ?? 0) + (assigned.data.value?.comments.length ?? 0))
}
