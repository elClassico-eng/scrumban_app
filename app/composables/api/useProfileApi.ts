import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type {
  UpdateUserProfileInput,
  UserProfile,
  UserProfileResponse,
} from '#shared/types/auth'

export interface SessionDevice {
  id: string
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
  current: boolean
}

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
      // PATCH returns a partial user; merge so fields it omits survive in cache.
      qc.setQueryData(['users', 'me'], (prev: UserProfileResponse | undefined) =>
        prev ? { user: { ...prev.user, ...data.user } } : data,
      )
      qc.setQueryData(['auth', 'session'], (prev: { user?: UserProfile } | undefined) =>
        prev ? { user: { ...prev.user, ...data.user } } : { user: data.user },
      )
    },
  })

  const changePassword = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      $fetch<{ ok: boolean }>(apiRoutes.usersMePassword, { method: 'POST', body: input }),
  })

  const sessions = useQuery({
    queryKey: ['users', 'me', 'sessions'],
    queryFn: () => $fetch<{ sessions: SessionDevice[] }>(apiRoutes.usersMeSessions),
  })

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) =>
      $fetch(apiRoutes.usersMeSession(sessionId), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'me', 'sessions'] }),
  })

  const revokeOtherSessions = useMutation({
    mutationFn: () => $fetch<{ revoked: number }>(apiRoutes.usersMeSessions, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'me', 'sessions'] }),
  })

  const deleteAccount = useMutation({
    mutationFn: (input: { password: string }) =>
      $fetch<null>(apiRoutes.usersMe, { method: 'DELETE', body: input }),
  })

  return { me, update, changePassword, sessions, revokeSession, revokeOtherSessions, deleteAccount }
}