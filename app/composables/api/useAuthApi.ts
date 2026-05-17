import { useQuery, useMutation } from '@tanstack/vue-query'
import { apiRoutes, pageRoutes } from '~/routing'
import type {
  SessionResponse,
  LoginInput,
  RegisterInput,
} from '#shared/types/auth'

export function useAuthApi() {
  const route = useRoute()

  // Only allow same-origin relative paths to prevent open-redirect via ?next=.
  function pickRedirectTarget(): string {
    const n = route.query.next
    if (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.includes('://')) {
      return n
    }
    return pageRoutes.workspaces
  }

  const sessionQuery = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => $fetch<SessionResponse>(apiRoutes.authSession),
    staleTime: 5 * 60_000,
    // /api/auth/session throws 401 when unauthenticated; retrying that
    // would just delay middleware redirects and waste a request.
    retry: false,
  })

  // Auth transitions force a full reload instead of in-app navigation.
  // We tried the soft route (qc.clear + setQueryData + router.push) and
  // hit a stubborn "old email sticks in the header after relogin" bug
  // that survived cache rewrites and rebuilds. A hard reload wipes Pinia,
  // vue-query, and any other cached state in one shot, and the browser
  // re-sends the new session cookie — guaranteeing the next render sees
  // the correct user. Standard pattern for auth boundaries in SPAs.
  const login = useMutation({
    mutationFn: (input: LoginInput) =>
      $fetch<SessionResponse>(apiRoutes.authLogin, { method: 'POST', body: input }),
    onSuccess: () => {
      window.location.href = pickRedirectTarget()
    },
  })

  const register = useMutation({
    mutationFn: (input: RegisterInput) =>
      $fetch<SessionResponse>(apiRoutes.authRegister, { method: 'POST', body: input }),
    onSuccess: () => {
      window.location.href = pickRedirectTarget()
    },
  })

  const logout = useMutation({
    mutationFn: () => $fetch(apiRoutes.authLogout, { method: 'POST' }),
    onSuccess: () => {
      window.location.href = pageRoutes.login
    },
  })

  return { sessionQuery, login, register, logout }
}
