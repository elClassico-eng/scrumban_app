import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type {
  UpdateUserProfileInput,
  UserProfile,
  UserProfileResponse,
} from '#shared/types/auth'

export function useProfileApi() {
  const qc = useQueryClient()

  const me = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => $fetch<UserProfileResponse>(apiRoutes.usersMe),
    retry: false,
  })

  const update = useMutation({
    mutationFn: (input: UpdateUserProfileInput) =>
      $fetch<UserProfileResponse>(apiRoutes.usersMe, { method: 'PATCH', body: input }),
    onSuccess: (data) => {
      qc.setQueryData(['users', 'me'], data)
      qc.setQueryData(['auth', 'session'], (prev: { user?: UserProfile } | undefined) =>
        prev ? { user: { ...prev.user, ...data.user } } : { user: data.user },
      )
    },
  })

  return { me, update }
}