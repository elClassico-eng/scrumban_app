export function useSettingsWorkspace() {
  const route = useRoute()
  const { list } = useWorkspacesApi()
  const current = computed(() =>
    (list.data.value?.workspaces ?? []).find(w => w.id === route.params.id) ?? null,
  )
  return { current, isLoading: list.isLoading }
}
