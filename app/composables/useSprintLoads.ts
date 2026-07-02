import type { MaybeRef } from 'vue'

export type SprintLoad = { taskCount: number, committedSp: number }

export function useSprintLoads(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
) {
  const { list: membershipsQuery } = useBoardSprintMembershipsApi(workspaceId, boardId)
  const { list: tasksQuery } = useTasksApi(workspaceId, boardId)

  const loadBySprintId = computed(() => {
    const spByTaskId = new Map<string, number>()
    for (const t of tasksQuery.data.value?.tasks ?? []) spByTaskId.set(t.id, t.storyPoints ?? 0)
    const map = new Map<string, SprintLoad>()
    for (const m of membershipsQuery.data.value?.memberships ?? []) {
      const cur = map.get(m.sprintId) ?? { taskCount: 0, committedSp: 0 }
      cur.taskCount += 1
      cur.committedSp += spByTaskId.get(m.taskId) ?? 0
      map.set(m.sprintId, cur)
    }
    return map
  })

  return { loadBySprintId }
}
