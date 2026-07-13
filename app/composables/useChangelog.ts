import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type { UserProfileResponse } from '#shared/types/auth'

export function useChangelog() {
  const qc = useQueryClient()
  const { me } = useProfileApi()

  const { data } = useAsyncData('changelog', () =>
    queryCollection('changelog').order('date', 'DESC').all(),
  )

  const entries = computed(() => data.value ?? [])

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

  return { entries, hasUnread, markSeen }
}

export type ChangelogEntryDoc = ReturnType<typeof useChangelog>['entries']['value'][number]
