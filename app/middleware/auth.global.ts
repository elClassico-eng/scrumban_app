import { pageRoutes } from '~/routing'

const PUBLIC_ROUTES: ReadonlyArray<string> = [
  pageRoutes.home,
  pageRoutes.login,
  pageRoutes.register,
]

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.includes(to.path)) return

  const { sessionQuery } = useAuthApi()
  if (sessionQuery.isLoading.value) {
    await sessionQuery.suspense()
  }

  if (!sessionQuery.data.value?.user) {
    return navigateTo(pageRoutes.login)
  }
})