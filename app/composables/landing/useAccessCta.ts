import { pageRoutes } from '~/routing'

export function useAccessCta() {
  const { sessionQuery } = useAuthApi()
  const authenticated = computed(() => !!sessionQuery.data.value?.user)

  return {
    authenticated,
    label: computed(() => (authenticated.value ? 'Открыть Такт' : 'Ранний доступ')),
    heroLabel: computed(() => (authenticated.value ? 'Открыть Такт' : 'Получить доступ')),
    go: () =>
      navigateTo(authenticated.value ? pageRoutes.workspaces : pageRoutes.login, { external: true }),
  }
}
