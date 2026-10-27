import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type { UserProfileResponse } from '#shared/types/auth'

export function useChangelog() {
  const qc = useQueryClient()
  const { me } = useProfileApi()

  const { data, status, refresh } = useAsyncData('changelog', async () => {
    try {
      return await queryCollection('changelog').order('date', 'DESC').all()
    }
    catch (err) {
      console.warn('[changelog] collection unavailable, hiding «Что нового»', err)
      return null
    }
  }, { default: () => [] })

  const entries = computed(() => data.value ?? [])
  const loading = computed(() => status.value === 'idle' || status.value === 'pending')

  function retryIfFailed() {
    if (data.value === null) refresh()
  }

  const hasUnread = computed(() => {
    const latest = entries.value[0]?.date
    if (!latest) return false
    const seen = me.data.value?.user.changelogSeenAt
    if (!seen) return true
    return new Date(latest).getTime() > new Date(seen).getTime()
  })

  const seenMutation = useMutation({
    mutationFn: () =>
      $fetch<{ changelogSeenAt: string }>(apiRoutes.usersChangelogSeen, { method: 'POST' }),
    onSuccess: (res) => {
      qc.setQueryData<UserProfileResponse>(['users', 'me'], prev =>
        prev ? { user: { ...prev.user, changelogSeenAt: res.changelogSeenAt } } : prev,
      )
    },
  })

  function markSeen() {
    if (hasUnread.value) seenMutation.mutate()
  }

  return { entries, loading, hasUnread, markSeen, retryIfFailed }
}

export type ChangelogEntryDoc = ReturnType<typeof useChangelog>['entries']['value'][number]
