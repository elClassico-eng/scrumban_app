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
          const e = err as { statusCode?: number; data?: { message?: string } }
          if (e?.statusCode === 422) {
            toast.add({
              title: 'WIP лимит достигнут',
              description: 'Освободи слот в колонке или промоутни задачу в expedite.',
              color: 'warning',
              icon: 'i-lucide-alert-circle',
            })
          }
          else {
            toast.add({
              title: 'Не удалось переместить задачу',
              description: e?.data?.message ?? 'Попробуй ещё раз',
              color: 'error',
              icon: 'i-lucide-alert-circle',
            })
          }
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKey.value }),
      },
    )
  }

  return { moveTask, isMoving: move.isPending }
}
