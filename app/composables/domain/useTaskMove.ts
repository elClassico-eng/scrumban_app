import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { TasksListResponse } from '#shared/types/task'

export function useTaskMove(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()
  const toast = useToast()
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

    move.mutate(
      { taskId, toColumnId, toPosition },
      {
        onError: (err) => {
          qc.invalidateQueries({ queryKey: queryKey.value })
          const isWipBlock = getErrorStatus(err) === 422
          toast.add({
            title: isWipBlock ? 'WIP-лимит достигнут' : 'Не удалось переместить задачу',
            description: getErrorMessage(err, 'Попробуй ещё раз'),
            color: isWipBlock ? 'warning' : 'error',
            icon: 'i-lucide-alert-circle',
          })
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
      },
    )
  }

  return { moveTask, isMoving: move.isPending }
}
