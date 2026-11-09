import { pageRoutes } from '~/routing'
import { homeRedirect, LAST_PATH_KEY, START_PAGE_KEY } from '~/utils/home-redirect'
import { AUTH_ROUTES, isPublicPath } from '~/utils/public-routes'

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
  // to their workspaces unless they explicitly asked for the landing (?about).
  if (to.path === pageRoutes.home) {
    const target = homeRedirect({ authenticated, about: to.query.about !== undefined, lastPath: localStorage.getItem(LAST_PATH_KEY), startPage: localStorage.getItem(START_PAGE_KEY) })
    if (target) return navigateTo(target)
    if (!authenticated) localStorage.removeItem(LAST_PATH_KEY)
    return
  }

  if (authenticated && AUTH_ROUTES.includes(to.path)) {
    return navigateTo(pageRoutes.workspaces)
  }

  if (isPublicPath(to.path)) return
  if (authenticated) {
    localStorage.setItem(LAST_PATH_KEY, to.fullPath)
    return
  }
  if (!authenticated) {
    return navigateTo({
      path: pageRoutes.login,
      query: to.fullPath === '/' ? undefined : { next: to.fullPath },
    })
  }
})