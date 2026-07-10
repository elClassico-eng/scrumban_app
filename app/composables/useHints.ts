import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type { UserProfileResponse } from '#shared/types/auth'

export function useHints() {
  const qc = useQueryClient()
  const { me } = useProfileApi()

  const hints = computed(() => me.data.value?.user.dismissedHints)
  const ready = computed(() => hints.value !== undefined)

  function isDismissed(key: string): boolean {
    return hints.value?.includes(key) ?? false
  }

  const dismissMutation = useMutation({
    mutationFn: (key: string) =>
      $fetch<{ dismissedHints: string[] }>(apiRoutes.usersDismissHint, {
        method: 'POST',
        body: { key },
      }),
    onMutate: async (key) => {
      qc.setQueryData<UserProfileResponse>(['users', 'me'], (prev) =>
        prev
          ? {
              user: {
                ...prev.user,
                dismissedHints: prev.user.dismissedHints.includes(key)
                  ? prev.user.dismissedHints
                  : [...prev.user.dismissedHints, key],
              },
            }
          : prev,
      )
    },
    onSuccess: (data) => {
      qc.setQueryData<UserProfileResponse>(['users', 'me'], (prev) =>
        prev ? { user: { ...prev.user, dismissedHints: data.dismissedHints } } : prev,
      )
    },
  })

  function dismiss(key: string) {
    dismissMutation.mutate(key)
  }

  return { ready, isDismissed, dismiss }
}
