import { useMounted } from '@vueuse/core'
import { pageRoutes } from '~/routing'

export function useAccessCta() {
  const { sessionQuery } = useAuthApi()
  // The landing is prerendered as the guest version; the first client render
  // must match it or Vue reports a hydration mismatch, so the signed-in
  // labels only appear after mount.
  const mounted = useMounted()
  const authenticated = computed(() => mounted.value && !!sessionQuery.data.value?.user)

  return {
    authenticated,
    startLabel: computed(() => (authenticated.value ? 'Открыть Такт' : 'Начать бесплатно')),
    start: () =>
      navigateTo(authenticated.value ? pageRoutes.workspaces : pageRoutes.register, { external: true }),
    go: () =>
      navigateTo(authenticated.value ? pageRoutes.workspaces : pageRoutes.login, { external: true }),
  }
}
