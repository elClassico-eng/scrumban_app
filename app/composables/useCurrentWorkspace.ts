export function useCurrentWorkspace() {
  const workspaceStore = useWorkspaceStore()
  const { list } = useWorkspacesApi()

  const workspaces = computed(() => list.data.value?.workspaces ?? [])

  // The stored id can point at a workspace the user no longer has: deleted,
  // left, or pasted from someone else's link. Fall back to the first
  // available one so the sidebar and the pages never disagree about which
  // workspace is current.
  const current = computed(() =>
    workspaces.value.find(w => w.id === workspaceStore.currentId) ?? workspaces.value[0] ?? null,
  )

  return { current, workspaces, isLoading: list.isLoading }
}
