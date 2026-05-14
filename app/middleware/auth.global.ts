import { pageRoutes } from '~/routing'

const AUTH_ROUTES: ReadonlyArray<string> = [pageRoutes.login, pageRoutes.register]

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

  if (AUTH_ROUTES.includes(to.path)) return
  if (!authenticated) return navigateTo(pageRoutes.login)
})