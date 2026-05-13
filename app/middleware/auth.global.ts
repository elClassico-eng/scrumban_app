import { pageRoutes } from '~/routing'

const AUTH_ROUTES: ReadonlyArray<string> = [pageRoutes.login, pageRoutes.register]
const PUBLIC_ROUTES: ReadonlyArray<string> = [pageRoutes.home, ...AUTH_ROUTES]

export default defineNuxtRouteMiddleware(async (to) => {
  const { sessionQuery } = useAuthApi()
  if (sessionQuery.isLoading.value) {
    await sessionQuery.suspense()
  }
  const authenticated = !!sessionQuery.data.value?.user

  // Already logged in users that hit /login or /register go straight to
  // their workspaces — keeps the redirect logic in one synchronous place
  // and avoids the per-page watchEffect race that flashed the login form
  // briefly when navigating between auth pages.
  if (authenticated && AUTH_ROUTES.includes(to.path)) {
    return navigateTo(pageRoutes.workspaces)
  }

  if (PUBLIC_ROUTES.includes(to.path)) return
  if (!authenticated) return navigateTo(pageRoutes.login)
})