import type { Notification } from '#shared/types/notification'
import { renderNotification } from '~/utils/notification-render'

export type TileNotif = {
  id: string
  icon: string
  color: string
  title: string
  why: string
  cta: string
  hasTarget: boolean
  t: string
  unread: boolean
}

export type PeekChip = {
  iconType: 'move' | 'at' | 'build' | 'check'
  color: string
  title: string
  sub: string
  act: string
}

export function useIslandNotifications() {
  const { list, unreadCount: unreadQuery, markRead: markReadMutation } = useNotificationsApi()

  const rawNotifs = computed(() => list.data.value?.notifications ?? [])
  const notifs = computed<TileNotif[]>(() => rawNotifs.value.map((n) => {
    const r = renderNotification(n)
    return {
      id: n.id,
      icon: r.icon,
      color: r.color,
      title: r.title,
      why: r.why,
      cta: r.cta,
      hasTarget: r.target !== null,
      t: formatRelativeDate(n.createdAt),
      unread: n.readAt === null,
    }
  }))
  const unreadCount = computed(() => unreadQuery.data.value?.count ?? 0)

  const primed = ref(false)
  watch(() => list.isFetched.value, (fetched) => {
    if (fetched) primed.value = true
  }, { immediate: true })

  function peekFor(n: Notification): PeekChip {
    const r = renderNotification(n)
    return {
      iconType: n.type === 'mention' || n.type === 'comment_on_assigned' ? 'at' : 'check',
      color: r.color,
      title: r.title,
      sub: r.why,
      act: r.target ? r.cta : '',
    }
  }

  function targetOf(id: string) {
    const n = rawNotifs.value.find(x => x.id === id)
    return n ? renderNotification(n).target : null
  }

  function markRead(id: string) {
    markReadMutation.mutate(id)
  }

  return { rawNotifs, notifs, unreadCount, primed, peekFor, targetOf, markRead }
}
