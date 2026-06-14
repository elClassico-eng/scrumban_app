import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { TasksListResponse } from '#shared/types/task'

export function useTaskMove(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()
  const toast = useToast()
  const { move, queryKey, list: tasksList } = useTasksApi(workspaceId, boardId)
  const { list: columnsList } = useColumnsApi(workspaceId, boardId)

  async function moveTask(taskId: string, toColumnId: string, toPosition: number) {
    const task = tasksList.data.value?.tasks.find(t => t.id === taskId)
    if (!task) return
    if (task.columnId === toColumnId && task.position === toPosition) return

    const toColumn = columnsList.data.value?.columns.find(c => c.id === toColumnId)
    const columnName = toColumn?.name ?? 'другую колонку'

    await qc.cancelQueries({ queryKey: queryKey.value })
    const prev = qc.getQueryData<TasksListResponse>(queryKey.value)
    qc.setQueryData<TasksListResponse>(queryKey.value, (old) => {
      if (!old) return old
      return {
        tasks: old.tasks.map(t =>
          t.id === taskId ? { ...t, columnId: toColumnId, position: toPosition } : t,
        ),
      }
    })

    try {
      await move.mutateAsync({ taskId, toColumnId, toPosition })
      toast.add({
        title: `Задача перенесена в «${columnName}»`,
        icon: 'i-lucide-arrow-right',
        duration: 1500,
      })
    }
    catch (err) {
      if (prev) qc.setQueryData(queryKey.value, prev)
      else qc.invalidateQueries({ queryKey: queryKey.value })
      const isWipBlock = getErrorStatus(err) === 422
      toast.add({
        title: isWipBlock ? 'WIP-лимит достигнут' : 'Не удалось переместить задачу',
        description: getErrorMessage(err, 'Попробуй ещё раз'),
        color: isWipBlock ? 'warning' : 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  }

  return { moveTask, isMoving: move.isPending }
}
