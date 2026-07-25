import type { MaybeRefOrGetter } from 'vue'
import type { WorkspaceSprintSummary } from '#shared/types/sprint'

export function useActiveSprint(
  wsId: MaybeRefOrGetter<string>,
  boardId: MaybeRefOrGetter<string | undefined>,
) {
  const { list } = useWorkspaceSprintsApi(computed(() => toValue(wsId)))

  const activeSprints = computed(() =>
    (list.data.value?.sprints ?? []).filter(s => s.state === 'active'),
  )

  const scoped = computed(() => {
    const board = toValue(boardId)
    return board ? activeSprints.value.filter(s => s.boardId === board) : activeSprints.value
  })

  // Nearest deadline wins: that is the sprint most likely to need attention.
  const sprint = computed<WorkspaceSprintSummary | null>(() => {
    const end = (s: WorkspaceSprintSummary) =>
      s.plannedEndAt ? new Date(s.plannedEndAt).getTime() : Number.POSITIVE_INFINITY
    return [...scoped.value].sort((a, b) => end(a) - end(b))[0] ?? null
  })

  return {
    sprint,
    otherActive: computed(() => Math.max(0, scoped.value.length - 1)),
    isLoading: list.isLoading,
  }
}
