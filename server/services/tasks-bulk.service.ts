// Bulk actions from the list view. Each task goes through the same service
// call a single edit would use (RBAC, WIP limits, notifications, SSE), one
// transaction per task, so a refusal on one task never undoes the others and
// the caller gets an honest per-task result.
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { taskAssignees, tasks, type ServiceClass, type WorkspaceMemberRole } from '../db/schema'
import { withTenant } from '../utils/db'
import { isDomainError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'
import { addTaskToSprint, removeTaskFromSprint } from './sprints.service'
import { deleteTask, moveTask, updateTaskFields } from './tasks.service'

export type BulkAction =
  | { type: 'move', columnId: string, force?: boolean, forceReason?: string }
  | { type: 'service_class', value: ServiceClass }
  | { type: 'assignee', userId: string | null }
  | { type: 'due', dueDate: Date | null }
  | { type: 'parent', parentTaskId: string | null }
  | { type: 'sprint_add', sprintId: string }
  | { type: 'sprint_remove', sprintId: string }
  | { type: 'delete' }

export type BulkResult = { taskId: string, ok: boolean, error?: string }

export async function bulkUpdateTasks(input: {
  workspaceId: string
  boardId: string
  taskIds: string[]
  action: BulkAction
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<BulkResult[]> {
  requireMinRole(input.actorRole, input.action.type === 'delete' ? 'admin' : 'member')
  const { workspaceId, action, actorId, actorRole } = input

  const rows = await withTenant(workspaceId, tx =>
    tx
      .select({ id: tasks.id, columnId: tasks.columnId })
      .from(tasks)
      .where(and(eq(tasks.boardId, input.boardId), inArray(tasks.id, input.taskIds))),
  )
  const onBoard = new Map(rows.map(r => [r.id, r]))

  let nextPosition = 0
  if (action.type === 'move') {
    const [agg] = await withTenant(workspaceId, tx =>
      tx.select({ n: sql<number>`count(*)::int` }).from(tasks).where(eq(tasks.columnId, action.columnId)),
    )
    nextPosition = agg?.n ?? 0
  }

  const results: BulkResult[] = []
  for (const taskId of input.taskIds) {
    const row = onBoard.get(taskId)
    if (!row) {
      results.push({ taskId, ok: false, error: 'Задача не найдена на этой доске' })
      continue
    }
    try {
      switch (action.type) {
        case 'move':
          if (row.columnId === action.columnId) break
          await moveTask({
            workspaceId, taskId, toColumnId: action.columnId, toPosition: nextPosition,
            force: action.force, forceReason: action.forceReason, actorId, actorRole,
          })
          nextPosition++
          break
        case 'service_class':
          await updateTaskFields({ workspaceId, taskId, patch: { serviceClass: action.value }, actorId, actorRole })
          break
        case 'assignee':
          await updateTaskFields({ workspaceId, taskId, patch: { assigneeId: action.userId }, actorId, actorRole })
          // "Assign to X" means X alone; co-assignees survive updateTaskFields
          // when X already was the primary assignee.
          await withTenant(workspaceId, tx =>
            tx.delete(taskAssignees).where(and(
              eq(taskAssignees.taskId, taskId),
              action.userId ? ne(taskAssignees.userId, action.userId) : sql`true`,
            )),
          )
          break
        case 'due':
          await updateTaskFields({ workspaceId, taskId, patch: { dueDate: action.dueDate }, actorId, actorRole })
          break
        case 'parent':
          await updateTaskFields({ workspaceId, taskId, patch: { parentTaskId: action.parentTaskId }, actorId, actorRole })
          break
        case 'sprint_add':
          await addTaskToSprint({ workspaceId, sprintId: action.sprintId, taskId, actorId, actorRole })
          break
        case 'sprint_remove':
          await removeTaskFromSprint({ workspaceId, sprintId: action.sprintId, taskId, actorId, actorRole })
          break
        case 'delete':
          await deleteTask({ workspaceId, taskId, actorRole })
          break
      }
      results.push({ taskId, ok: true })
    }
    catch (err) {
      if (!isDomainError(err)) throw err
      results.push({ taskId, ok: false, error: err.message })
    }
  }
  return results
}
