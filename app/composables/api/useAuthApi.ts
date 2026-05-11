import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes, pageRoutes } from '~/routing'
import type {
  SessionResponse,
  LoginInput,
  RegisterInput,
} from '#shared/types/auth'

export function useAuthApi() {
  const qc = useQueryClient()
  const router = useRouter()

  const sessionQuery = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => $fetch<SessionResponse>(apiRoutes.authSession),
    staleTime: 5 * 60_000,
    // /api/auth/session throws 401 when unauthenticated; retrying that
    // would just delay middleware redirects and waste a request.
    retry: false,
  })

  const login = useMutation({
    mutationFn: (input: LoginInput) =>
      $fetch<SessionResponse>(apiRoutes.authLogin, { method: 'POST', body: input }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] })
      await router.push(pageRoutes.workspaces)
    },
  })

  const register = useMutation({
    mutationFn: (input: RegisterInput) =>
      $fetch<SessionResponse>(apiRoutes.authRegister, { method: 'POST', body: input }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] })
      await router.push(pageRoutes.workspaces)
    },
  })

  const logout = useMutation({
    mutationFn: () => $fetch(apiRoutes.authLogout, { method: 'POST' }),
    onSuccess: async () => {
      // Logout drops every cached server-state entry, not just the session —
      // a different user logging in next must not see the previous user's
      // workspaces/boards from cache.
      qc.clear()
      await router.push(pageRoutes.login)
    },
  })

  return { sessionQuery, login, register, logout }
}
