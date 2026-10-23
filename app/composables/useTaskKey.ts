import type { MaybeRefOrGetter } from 'vue'
import type { Task } from '#shared/types/task'
import { formatTaskKey } from '#shared/utils/board-key'

export function useTaskKey(workspaceId?: MaybeRefOrGetter<string>) {
  const route = useRoute()
  const wsId = computed(() => toValue(workspaceId) ?? (route.params.id as string | undefined) ?? '')
  const { list } = useBoardsApi(wsId)
  const keys = computed(() => new Map((list.data.value?.boards ?? []).map(b => [b.id, b.key])))
  return (task: Pick<Task, 'boardId' | 'number'>) => formatTaskKey(keys.value.get(task.boardId), task.number)
}
