import { useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import type { TasksListResponse } from '#shared/types/task'

export function useTaskMove(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()
  const toast = useToast()
  const { defer } = useDeferredAction()
  const { move, queryKey, list: tasksList } = useTasksApi(workspaceId, boardId)
  const { list: columnsList } = useColumnsApi(workspaceId, boardId)

  function moveTask(taskId: string, toColumnId: string, toPosition: number) {
    const task = tasksList.data.value?.tasks.find(t => t.id === taskId)
    if (!task) return
    if (task.columnId === toColumnId && task.position === toPosition) return

    const toColumn = columnsList.data.value?.columns.find(c => c.id === toColumnId)
    const columnName = toColumn?.name ?? 'другую колонку'

    const prev = qc.getQueryData<TasksListResponse>(queryKey.value)

    defer({
      toast: {
        title: `Задача перенесена в «${columnName}»`,
        icon: 'i-lucide-arrow-right',
      },
      apply: () => {
        qc.setQueryData<TasksListResponse>(queryKey.value, (old) => {
          if (!old) return old
          return {
            tasks: old.tasks.map(t =>
              t.id === taskId ? { ...t, columnId: toColumnId, position: toPosition } : t,
            ),
          }
        })
        return prev
      },
      commit: () => move.mutateAsync({ taskId, toColumnId, toPosition }),
      rollback: (snapshot) => {
        if (snapshot) qc.setQueryData(queryKey.value, snapshot)
        else qc.invalidateQueries({ queryKey: queryKey.value })
      },
      onCommitError: (err, snapshot) => {
        if (snapshot) qc.setQueryData(queryKey.value, snapshot)
        else qc.invalidateQueries({ queryKey: queryKey.value })
        const isWipBlock = getErrorStatus(err) === 422
        toast.add({
          title: isWipBlock ? 'WIP-лимит достигнут' : 'Не удалось переместить задачу',
          description: getErrorMessage(err, 'Попробуй ещё раз'),
          color: isWipBlock ? 'warning' : 'error',
          icon: 'i-lucide-alert-circle',
        })
      },
    })
  }

  return { moveTask, isMoving: move.isPending }
}
