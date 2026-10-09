import type { Ref } from 'vue'

export function useIslandSprint(workspaceId: Ref<string>, boardId: Ref<string>) {
  const { list: sprintsList } = useSprintsApi(workspaceId, boardId)
  const activeSprint = computed(() => sprintsList.data.value?.sprints.find(s => s.state === 'active') ?? null)
  const hasSprint = computed(() => activeSprint.value !== null)

  const sprintPct = computed(() => {
    const s = activeSprint.value
    if (!s || !s.startedAt || !s.plannedEndAt) return 0
    const start = new Date(s.startedAt).getTime()
    const end = new Date(s.plannedEndAt).getTime()
    if (end <= start) return 0
    return Math.round(Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)))
  })

  const sprintCaption = computed(() => {
    const s = activeSprint.value
    if (!s) return 'Нет активного спринта'
    if (!s.plannedEndAt) return s.name
    const daysLeft = Math.max(0, Math.ceil((new Date(s.plannedEndAt).getTime() - Date.now()) / 86_400_000))
    return `${s.name} · ${daysLeft} дн`
  })

  return { activeSprint, hasSprint, sprintPct, sprintCaption }
}
