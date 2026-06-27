import { pageRoutes } from '~/routing'

const AUTH_ROUTES: ReadonlyArray<string> = [
  pageRoutes.login,
  pageRoutes.register,
  pageRoutes.forgotPassword,
]
// Public pages reachable by guests and authenticated users alike — unlike
// AUTH_ROUTES, signed-in users are not bounced away from these.
const PUBLIC_ROUTES: ReadonlyArray<string> = [
  pageRoutes.privacy,
]
const PUBLIC_PREFIXES: ReadonlyArray<string> = [
  '/verify-email/',
  '/reset-password/',
  '/invite/',
]

function isPublicRoute(path: string): boolean {
  return AUTH_ROUTES.includes(path)
    || PUBLIC_ROUTES.includes(path)
    || PUBLIC_PREFIXES.some(p => path.startsWith(p))
}

export default defineNuxtRouteMiddleware(async (to) => {
  // During prerender/SSR there is no session cookie, so the prerendered '/'
  // is always the guest landing. The client re-runs this middleware after
  // hydration and redirects authenticated users to their workspaces.
  if (import.meta.server) return

  const { sessionQuery } = useAuthApi()
  if (sessionQuery.isLoading.value) {
    await sessionQuery.suspense()
  }
  const authenticated = !!sessionQuery.data.value?.user

  // Home is the public landing for guests; authenticated users go straight
  // to their workspaces.
  if (to.path === pageRoutes.home) {
    if (authenticated) return navigateTo(pageRoutes.workspaces)
    return
  }

  if (authenticated && AUTH_ROUTES.includes(to.path)) {
    return navigateTo(pageRoutes.workspaces)
  }

  if (isPublicRoute(to.path)) return
  if (!authenticated) {
    return navigateTo({
      path: pageRoutes.login,
      query: to.fullPath === '/' ? undefined : { next: to.fullPath },
    })
  }
})