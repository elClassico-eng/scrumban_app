// TasksService: basic CRUD over the tasks table.
//
// Scope of THIS step (Step 11): create / list / get / update fields /
// delete. Field updates here cover title, description, priority, and
// assignee — NOT column. Moving tasks between columns is a separate
// state-machine concern (Step 12) that also writes the task_events log.
//
// Authorisation matrix:
//   list / get          → viewer+
//   create / update     → member+ (developers do this every day)
//   delete              → admin+  (destructive; lose all task_events too)
//
// All queries go through withTenant() so RLS at the DB enforces tenant
// isolation as a second line of defence.
import { and, asc, eq, sql } from 'drizzle-orm'
import {
  tasks,
  type Task,
  type TaskPriority,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

export async function listTasksForBoard(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<Task[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select()
      .from(tasks)
      .where(eq(tasks.boardId, input.boardId))
      .orderBy(asc(tasks.columnId), asc(tasks.position)),
  )
}

export async function getTask(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<Task> {
  requireMinRole(input.actorRole, 'viewer')
  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx.select().from(tasks).where(eq(tasks.id, input.taskId)),
  )
  if (!row) throw new NotFoundError('Task not found')
  return row
}

export async function createTask(input: {
  workspaceId: string
  boardId: string
  columnId: string
  title: string
  description?: string
  priority?: TaskPriority
  assigneeId?: string | null
  actorRole: WorkspaceMemberRole
}): Promise<Task> {
  requireMinRole(input.actorRole, 'member')

  return withTenant(input.workspaceId, async (tx) => {
    // Append at the end of the column. COALESCE handles the empty-column case.
    const [agg] = await tx
      .select({
        next: sql<number>`COALESCE(MAX(${tasks.position}), -1) + 1`,
      })
      .from(tasks)
      .where(and(eq(tasks.boardId, input.boardId), eq(tasks.columnId, input.columnId)))

    const [row] = await tx
      .insert(tasks)
      .values({
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        columnId: input.columnId,
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? 'medium',
        assigneeId: input.assigneeId ?? null,
        position: Number(agg!.next),
      })
      .returning()
    return row!
  })
}

export async function updateTaskFields(input: {
  workspaceId: string
  taskId: string
  patch: {
    title?: string
    description?: string
    priority?: TaskPriority
    assigneeId?: string | null
  }
  actorRole: WorkspaceMemberRole
}): Promise<Task> {
  requireMinRole(input.actorRole, 'member')

  // Build SET clause from defined keys only. assigneeId may be set to null
  // explicitly (un-assign), so check `in` rather than truthiness.
  const set: Partial<typeof tasks.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if (input.patch.title !== undefined) set.title = input.patch.title
  if (input.patch.description !== undefined) set.description = input.patch.description
  if (input.patch.priority !== undefined) set.priority = input.patch.priority
  if ('assigneeId' in input.patch) set.assigneeId = input.patch.assigneeId ?? null

  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx.update(tasks).set(set).where(eq(tasks.id, input.taskId)).returning(),
  )
  if (!row) throw new NotFoundError('Task not found')
  return row
}

export async function deleteTask(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  const result = await withTenant(input.workspaceId, async (tx) =>
    tx.delete(tasks).where(eq(tasks.id, input.taskId)),
  )
  if ((result.count ?? 0) === 0) throw new NotFoundError('Task not found')
}
