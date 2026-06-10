// TasksService: basic CRUD over the tasks table.
//
// Scope of THIS step (Step 11 + Phase 5 step 2): create / list / get /
// update fields / delete. Field updates here cover title, description,
// service_class (Anderson CoS), dueDate, assignee — NOT column. Moving
// tasks between columns is a separate state-machine concern (Step 12)
// that also writes the task_events log.
//
// Authorisation matrix:
//   list / get          → viewer+
//   create / update     → member+ (developers do this every day)
//   delete              → admin+  (destructive; lose all task_events too)
//
// All queries go through withTenant() so RLS at the DB enforces tenant
// isolation as a second line of defence.
import { and, asc, eq, getTableColumns, gt, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import {
  boardColumns,
  taskAssignees,
  taskEvents,
  tasks,
  type ColumnRole,
  type ServiceClass,
  type Task,
  type TaskEvent,
  type TaskEventType,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant, type DbTransaction } from '../utils/db'

const taskWithAssigneesSelect = {
  ...getTableColumns(tasks),
  assigneeIds: sql<string[]>`COALESCE((
    SELECT array_agg(${taskAssignees.userId} ORDER BY ${taskAssignees.addedAt})
    FROM ${taskAssignees}
    WHERE ${taskAssignees.taskId} = ${tasks.id}
  ), ARRAY[]::uuid[])`.as('assignee_ids'),
}
import { NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { emitNotification } from './notifications.service'
import { requireMinRole } from '../utils/rbac'

export async function listTasksForBoard(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<Task[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select(taskWithAssigneesSelect)
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
    tx.select(taskWithAssigneesSelect).from(tasks).where(eq(tasks.id, input.taskId)),
  )
  if (!row) throw new NotFoundError('Задача не найдена')
  return row
}

export async function createTask(input: {
  workspaceId: string
  boardId: string
  columnId: string
  title: string
  description?: string
  serviceClass?: ServiceClass
  dueDate?: Date | null
  assigneeId?: string | null
  parentTaskId?: string | null
  storyPoints?: number | null
  actorId?: string
  actorRole: WorkspaceMemberRole
}): Promise<Task> {
  requireMinRole(input.actorRole, 'member')

  if (input.serviceClass === 'fixed_date' && !input.dueDate) {
    throw new ValidationError('Для класса «С дедлайном» нужен дедлайн')
  }

  if (input.parentTaskId) {
    const [parent] = await withTenant(input.workspaceId, async (tx) =>
      tx
        .select({ id: tasks.id, boardId: tasks.boardId })
        .from(tasks)
        .where(eq(tasks.id, input.parentTaskId!)),
    )
    if (!parent) throw new NotFoundError('Родительская задача не найдена')
    if (parent.boardId !== input.boardId) {
      throw new ValidationError('Родительская задача должна быть на той же доске')
    }
  }

  const expeditedAt = input.serviceClass === 'expedite' ? new Date() : null

  return withTenant(input.workspaceId, async (tx) => {
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
        serviceClass: input.serviceClass ?? 'standard',
        dueDate: input.dueDate ?? null,
        expeditedAt,
        assigneeId: input.assigneeId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        storyPoints: input.storyPoints ?? null,
        position: Number(agg!.next),
      })
      .returning()

    // Genesis row in the audit log so analytics knows when each task
    // entered the board and where it landed. fromColumnId is null
    // (no previous state); toColumnId carries the initial column.
    await tx.insert(taskEvents).values({
      workspaceId: input.workspaceId,
      taskId: row!.id,
      eventType: 'task_created',
      fromColumnId: null,
      toColumnId: input.columnId,
      actorId: input.actorId ?? null,
      payload: { initialPosition: row!.position },
    })

    if (row!.assigneeId) {
      await tx
        .insert(taskAssignees)
        .values({
          taskId: row!.id,
          userId: row!.assigneeId,
          workspaceId: input.workspaceId,
          addedBy: input.actorId ?? null,
        })
        .onConflictDoNothing()

      await emitNotification({
        tx,
        workspaceId: input.workspaceId,
        recipientId: row!.assigneeId,
        actorId: input.actorId ?? null,
        type: 'assigned',
        payload: {
          taskId: row!.id,
          boardId: input.boardId,
          taskTitle: row!.title,
          actorId: input.actorId ?? null,
        },
      })
    }

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
    serviceClass?: ServiceClass
    dueDate?: Date | null
    assigneeId?: string | null
    parentTaskId?: string | null
    blockedReason?: string | null
    isEpic?: boolean
    storyPoints?: number | null
  }
  actorId?: string
  actorRole: WorkspaceMemberRole
}): Promise<Task> {
  requireMinRole(input.actorRole, 'member')

  // Build SET clause from defined keys only. assigneeId / dueDate may be
  // set to null explicitly, so check `in` rather than truthiness.
  const set: Partial<typeof tasks.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if (input.patch.title !== undefined) set.title = input.patch.title
  if (input.patch.description !== undefined) set.description = input.patch.description
  if (input.patch.serviceClass !== undefined) {
    set.serviceClass = input.patch.serviceClass
    // Stamp expedited_at when promoting TO expedite; clear when leaving.
    if (input.patch.serviceClass === 'expedite') set.expeditedAt = new Date()
    else set.expeditedAt = null
  }
  if ('dueDate' in input.patch) set.dueDate = input.patch.dueDate ?? null
  if ('assigneeId' in input.patch) set.assigneeId = input.patch.assigneeId ?? null
  if ('blockedReason' in input.patch) {
    const trimmed = input.patch.blockedReason?.trim()
    set.blockedReason = trimmed ? trimmed : null
  }
  if (input.patch.isEpic !== undefined) set.isEpic = input.patch.isEpic
  if ('storyPoints' in input.patch) set.storyPoints = input.patch.storyPoints ?? null

  // Parent change needs cycle + same-board validation. Run it inside the
  // same transaction as the UPDATE so check and write are atomic — a
  // separate read transaction leaves a window for a concurrent re-parent
  // to slip a cycle past the check.
  const newParentId =
    'parentTaskId' in input.patch ? (input.patch.parentTaskId ?? null) : undefined
  if (newParentId !== undefined) set.parentTaskId = newParentId

  const row = await withTenant(input.workspaceId, async (tx) => {
    if (newParentId !== undefined) {
      await validateParentAssignment(tx, input.taskId, newParentId)
    }
    const [prev] = await tx
      .select({ assigneeId: tasks.assigneeId, title: tasks.title, boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
    if (!prev) throw new NotFoundError('Задача не найдена')

    const [updated] = await tx
      .update(tasks)
      .set(set)
      .where(eq(tasks.id, input.taskId))
      .returning()
    if (!updated) throw new NotFoundError('Задача не найдена')

    const assignmentChanged =
      'assigneeId' in input.patch && updated.assigneeId !== prev.assigneeId
    if (assignmentChanged) {
      await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, input.taskId))
      if (updated.assigneeId) {
        await tx
          .insert(taskAssignees)
          .values({
            taskId: input.taskId,
            userId: updated.assigneeId,
            workspaceId: input.workspaceId,
            addedBy: input.actorId ?? null,
          })
          .onConflictDoNothing()

        await emitNotification({
          tx,
          workspaceId: input.workspaceId,
          recipientId: updated.assigneeId,
          actorId: input.actorId ?? null,
          type: 'assigned',
          payload: {
            taskId: updated.id,
            boardId: updated.boardId,
            taskTitle: updated.title,
            actorId: input.actorId ?? null,
          },
        })
      }
    }

    return updated
  })

  publishBoardEvent({
    type: 'task.updated',
    workspaceId: input.workspaceId,
    boardId: row.boardId,
    payload: row,
  })
  return row
}

// Walks the proposed parent chain to refuse a cycle. Also enforces the
// "parent lives on the same board" invariant — cross-board hierarchies
// confuse swimlane rendering and analytics.
async function validateParentAssignment(
  tx: DbTransaction,
  taskId: string,
  newParentId: string | null,
): Promise<void> {
  if (newParentId === null) return
  if (newParentId === taskId) {
    throw new ValidationError('Задача не может быть родителем самой себе')
  }

  const [child] = await tx
    .select({ boardId: tasks.boardId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
  if (!child) throw new NotFoundError('Задача не найдена')

  const [parent] = await tx
    .select({ id: tasks.id, boardId: tasks.boardId, parentTaskId: tasks.parentTaskId })
    .from(tasks)
    .where(eq(tasks.id, newParentId))
  if (!parent) throw new NotFoundError('Родительская задача не найдена')
  if (parent.boardId !== child.boardId) {
    throw new ValidationError('Родительская задача должна быть на той же доске')
  }

  // Climb the parent chain — if we ever reach the task we're trying to
  // re-parent, the result would be a cycle. Bounded by row count so a
  // corrupt chain can't spin forever.
  let cursor: string | null = parent.parentTaskId
  let hops = 0
  while (cursor && hops < 100) {
    if (cursor === taskId) {
      throw new ValidationError('Цикл в иерархии: задача уже является потомком этого родителя')
    }
    const [next] = await tx
      .select({ parentTaskId: tasks.parentTaskId })
      .from(tasks)
      .where(eq(tasks.id, cursor))
    cursor = next?.parentTaskId ?? null
    hops += 1
  }
}

export async function listSubTasks(input: {
  workspaceId: string
  parentTaskId: string
  actorRole: WorkspaceMemberRole
}): Promise<Task[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select(taskWithAssigneesSelect)
      .from(tasks)
      .where(eq(tasks.parentTaskId, input.parentTaskId))
      .orderBy(asc(tasks.position)),
  )
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
  if (!before) throw new NotFoundError('Задача не найдена')

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
// WIP limit (Phase 5 Anderson rules):
//   - service_class='expedite' ALWAYS bypasses (queue-jumping is the
//     defining behaviour of the class)
//   - Any other class + force=true requires actorRole >= admin AND a
//     non-empty forceReason (logged into task_events.payload for audit)
//   - Otherwise, WIP-full destination → 422
const PARKING_POSITION = 1_000_000

export async function moveTask(input: {
  workspaceId: string
  taskId: string
  toColumnId: string
  toPosition: number
  actorId: string
  actorRole: WorkspaceMemberRole
  force?: boolean
  forceReason?: string
}): Promise<Task> {
  requireMinRole(input.actorRole, 'member')
    
  if (input.force) {
    requireMinRole(input.actorRole, 'admin')
    if (!input.forceReason || input.forceReason.trim().length === 0) {
      throw new ValidationError('При force=true нужно указать причину (forceReason)')
    }
  }

  return withTenant(input.workspaceId, async (tx) => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (!task) throw new NotFoundError('Задача не найдена')

    const [fromCol] = await tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, task.columnId))
    const [toCol] = await tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, input.toColumnId))

    if (!toCol) throw new NotFoundError('Колонка назначения не найдена')
    if (toCol.boardId !== task.boardId) {
      throw new ValidationError('Колонка назначения относится к другой доске')
    }

    // Serialize concurrent moves touching either column by locking the
    // column definition rows (ordered by id to avoid deadlock). The WIP
    // count and position renumbering below are check-then-write sequences;
    // without this lock two parallel moves into the same column both pass
    // the WIP check and duplicate positions. board_columns rows are stable,
    // so the lock works even when the destination column is empty (a
    // FOR UPDATE on tasks would lock nothing in that case).
    await tx
      .select({ id: boardColumns.id })
      .from(boardColumns)
      .where(inArray(boardColumns.id, [task.columnId, input.toColumnId]))
      .orderBy(asc(boardColumns.id))
      .for('update')

    const isCrossColumn = task.columnId !== input.toColumnId
    const expediteBypass = task.serviceClass === 'expedite'

    // WIP enforcement only on cross-column moves; reordering within the
    // same column doesn't change column population.
    if (isCrossColumn && toCol.wipLimit !== null && !input.force && !expediteBypass) {
      const [agg] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.columnId, input.toColumnId))
      if ((agg!.n ?? 0) >= toCol.wipLimit) {
        throw new ValidationError(
          `Достигнут WIP-лимит колонки (${toCol.wipLimit}). Переведи задачу в Expedite или попроси админа принудительно переместить её с указанием причины.`,
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
        ...(expediteBypass
          ? { bypassedWip: 'expedite' as const }
          : input.force
            ? { bypassedWip: 'force' as const, forceReason: input.forceReason }
            : {}),
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
