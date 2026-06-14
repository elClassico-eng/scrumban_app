import { pageRoutes } from '~/routing'

export function useAccessCta() {
  const { sessionQuery } = useAuthApi()
  return () => {
    const authenticated = !!sessionQuery.data.value?.user
    return navigateTo(authenticated ? pageRoutes.workspaces : pageRoutes.login)
  }
}