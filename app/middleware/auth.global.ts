import { pageRoutes } from '~/routing'

const AUTH_ROUTES: ReadonlyArray<string> = [
  pageRoutes.login,
  pageRoutes.register,
  pageRoutes.forgotPassword,
]
const PUBLIC_PREFIXES: ReadonlyArray<string> = ['/verify-email/', '/reset-password/']

function isPublicRoute(path: string): boolean {
  return AUTH_ROUTES.includes(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { sessionQuery } = useAuthApi()
  if (sessionQuery.isLoading.value) {
    await sessionQuery.suspense()
  }
  const authenticated = !!sessionQuery.data.value?.user

  // Home is a routing hub, not a real page — bounce by auth state.
  if (to.path === pageRoutes.home) {
    return navigateTo(authenticated ? pageRoutes.workspaces : pageRoutes.login)
  }

  if (authenticated && AUTH_ROUTES.includes(to.path)) {
    return navigateTo(pageRoutes.workspaces)
  }

  if (isPublicRoute(to.path)) return
  if (!authenticated) return navigateTo(pageRoutes.login)
})