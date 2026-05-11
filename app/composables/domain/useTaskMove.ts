import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { TasksListResponse } from '#shared/types/task'

export function useTaskMove(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()
  const { move, queryKey } = useTasksApi(workspaceId, boardId)

  function moveTask(taskId: string, toColumnId: string, toPosition: number) {
    qc.setQueryData<TasksListResponse>(queryKey.value, (old) => {
      if (!old) return old
      return {
        tasks: old.tasks.map(t =>
          t.id === taskId ? { ...t, columnId: toColumnId, position: toPosition } : t,
        ),
      }
    })

    // Server authoritatively renumbers neighbours' positions on insert/remove,
    // so we re-fetch in both branches to pick that up. On error the refetch
    // also serves as a rollback to truth.
    move.mutate(
      { taskId, toColumnId, toPosition },
      {
        onError: () => qc.invalidateQueries({ queryKey: queryKey.value }),
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
      },
    )
  }

  return { moveTask, isMoving: move.isPending }
}
