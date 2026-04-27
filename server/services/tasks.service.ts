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
import { and, asc, eq, gt, gte, lt, lte, sql } from 'drizzle-orm'
import {
  boardColumns,
  taskEvents,
  tasks,
  type ColumnRole,
  type Task,
  type TaskEvent,
  type TaskEventType,
  type TaskPriority,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
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
  }).then((row) => {
    // Publish AFTER the transaction commits so a rollback never produces
    // a phantom "task created" event.
    publishBoardEvent({
      type: 'task.created',
      workspaceId: input.workspaceId,
      boardId: input.boardId,
      payload: row,
    })
    return row
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

  publishBoardEvent({
    type: 'task.updated',
    workspaceId: input.workspaceId,
    boardId: row.boardId,
    payload: row,
  })
  return row
}

export async function deleteTask(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  // Capture the row BEFORE the delete so the SSE event payload knows the
  // boardId (and the column id, useful for clients animating the removal).
  const before = await withTenant(input.workspaceId, async (tx) => {
    const [row] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (!row) return null
    await tx.delete(tasks).where(eq(tasks.id, input.taskId))
    return row
  })
  if (!before) throw new NotFoundError('Task not found')

  publishBoardEvent({
    type: 'task.deleted',
    workspaceId: input.workspaceId,
    boardId: before.boardId,
    payload: { taskId: input.taskId, columnId: before.columnId },
  })
}

// Move a task to a different column and/or position. The whole operation
// runs inside one transaction so:
//   - the FK constraints + RLS policies all see consistent state,
//   - position renumbering doesn't expose duplicates to other readers,
//   - the task_events row is committed atomically with the state change
//     it describes (no "ghost events" on a rollback).
//
// State-machine side effects:
//   - entering a column whose column_role = 'done'    → sets closed_at = now
//   - leaving a column whose column_role = 'done'     → clears closed_at,
//                                                       reopened_count++
//   - moving to 'archived'                            → emits task_archived
//   - everything else                                 → emits task_moved
//
// WIP limit: if the destination column has a wipLimit AND it's already at
// or above the limit AND this is a cross-column move, the move is rejected
// with 422 unless the caller passes force=true.
const PARKING_POSITION = 1_000_000

export async function moveTask(input: {
  workspaceId: string
  taskId: string
  toColumnId: string
  toPosition: number
  actorId: string
  actorRole: WorkspaceMemberRole
  force?: boolean
}): Promise<Task> {
  requireMinRole(input.actorRole, 'member')

  return withTenant(input.workspaceId, async (tx) => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (!task) throw new NotFoundError('Task not found')

    const [fromCol] = await tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, task.columnId))
    const [toCol] = await tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, input.toColumnId))

    if (!toCol) throw new NotFoundError('Destination column not found')
    if (toCol.boardId !== task.boardId) {
      throw new ValidationError('Destination column belongs to a different board')
    }

    const isCrossColumn = task.columnId !== input.toColumnId

    // WIP enforcement only on cross-column moves; reordering within the
    // same column doesn't change column population.
    if (isCrossColumn && toCol.wipLimit !== null && !input.force) {
      const [agg] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.columnId, input.toColumnId))
      if ((agg!.n ?? 0) >= toCol.wipLimit) {
        throw new ValidationError(
          `Column WIP limit (${toCol.wipLimit}) reached. Pass force=true to override.`,
        )
      }
    }

    // Phase 1: park the task at a position that can't collide while we
    // shift its neighbours around. (We don't have a UNIQUE index on
    // (board_id, column_id, position) yet, but treating the column as if
    // we did keeps positions clean for ordering.)
    await tx
      .update(tasks)
      .set({ position: PARKING_POSITION })
      .where(eq(tasks.id, input.taskId))

    if (isCrossColumn) {
      // Source column: close the gap left by the task.
      await tx
        .update(tasks)
        .set({ position: sql`${tasks.position} - 1` })
        .where(and(eq(tasks.columnId, task.columnId), gt(tasks.position, task.position)))

      // Destination column: open a gap at toPosition.
      await tx
        .update(tasks)
        .set({ position: sql`${tasks.position} + 1` })
        .where(
          and(eq(tasks.columnId, input.toColumnId), gte(tasks.position, input.toPosition)),
        )
    } else {
      // Same-column reorder.
      if (input.toPosition > task.position) {
        await tx
          .update(tasks)
          .set({ position: sql`${tasks.position} - 1` })
          .where(
            and(
              eq(tasks.columnId, task.columnId),
              gt(tasks.position, task.position),
              lte(tasks.position, input.toPosition),
            ),
          )
      } else if (input.toPosition < task.position) {
        await tx
          .update(tasks)
          .set({ position: sql`${tasks.position} + 1` })
          .where(
            and(
              eq(tasks.columnId, task.columnId),
              gte(tasks.position, input.toPosition),
              lt(tasks.position, task.position),
            ),
          )
      }
    }

    // Phase 2: settle the moving task into its new home.
    const stateUpdate: Partial<typeof tasks.$inferInsert> & {
      columnId: string
      position: number
      updatedAt: Date
    } = {
      columnId: input.toColumnId,
      position: input.toPosition,
      updatedAt: new Date(),
    }

    // A "reopen" only counts when the task was actually closed (closedAt
    // is set). If it was sitting in Done with closedAt=NULL — created there
    // directly and never closed — leaving Done is just a regular move and
    // shouldn't bump reopened_count.
    const enteringDone = fromCol?.columnRole !== 'done' && toCol.columnRole === 'done'
    const leavingDoneAndWasClosed =
      fromCol?.columnRole === 'done' &&
      toCol.columnRole !== 'done' &&
      task.closedAt !== null
    if (enteringDone) {
      stateUpdate.closedAt = new Date()
    }
    if (leavingDoneAndWasClosed) {
      stateUpdate.closedAt = null
      stateUpdate.reopenedCount = task.reopenedCount + 1
    }

    const [moved] = await tx
      .update(tasks)
      .set(stateUpdate)
      .where(eq(tasks.id, input.taskId))
      .returning()

    // Pick the most specific event type so analytics doesn't have to
    // re-derive it from column_role joins later.
    const eventType: TaskEventType = enteringDone
      ? 'task_closed'
      : leavingDoneAndWasClosed
        ? 'task_reopened'
        : toCol.columnRole === 'archived'
          ? 'task_archived'
          : 'task_moved'

    await tx.insert(taskEvents).values({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      eventType,
      fromColumnId: task.columnId,
      toColumnId: input.toColumnId,
      actorId: input.actorId,
      payload: {
        fromPosition: task.position,
        toPosition: input.toPosition,
        fromColumnRole: fromCol?.columnRole as ColumnRole | undefined,
        toColumnRole: toCol.columnRole,
      },
    })

    return { moved: moved!, fromColumnId: task.columnId }
  }).then(({ moved, fromColumnId }) => {
    publishBoardEvent({
      type: 'task.moved',
      workspaceId: input.workspaceId,
      boardId: moved.boardId,
      payload: {
        task: moved,
        fromColumnId,
      },
    })
    return moved
  })
}

export async function listTaskEvents(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<TaskEvent[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx.select().from(taskEvents).where(eq(taskEvents.taskId, input.taskId)).orderBy(asc(taskEvents.createdAt)),
  )
}
