// ColumnsService: lifecycle for board_columns. Lives under withTenant() so
// RLS enforces tenant isolation; service checks add boardId scoping and
// the "no deleting non-empty columns" rule that the FK ON DELETE RESTRICT
// also enforces (we just translate the resulting PG error into a clean
// 422 instead of an opaque 500).
//
// Authorisation matrix (enforced here):
//   list             → viewer+
//   create / update  → admin+
//   delete           → admin+ (only when no tasks remain in the column)
//   reorder          → admin+
import { and, eq, sql } from 'drizzle-orm'
import {
  boardColumns,
  boards,
  type BoardColumn,
  type ColumnRole,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import {
  NotFoundError,
  ValidationError,
} from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

const PG_FK_VIOLATION = '23503'

export async function listColumns(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<BoardColumn[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.boardId, input.boardId))
      .orderBy(boardColumns.position),
  )
}

export async function createColumn(input: {
  workspaceId: string
  boardId: string
  name: string
  columnRole: ColumnRole
  wipLimit: number | null
  actorRole: WorkspaceMemberRole
}): Promise<BoardColumn> {
  requireMinRole(input.actorRole, 'admin')
  return withTenant(input.workspaceId, async (tx) => {
    // Lock the board row so concurrent column creates on the same board
    // serialize — otherwise both compute the same MAX(position)+1 and collide
    // on the (board_id, position) unique index (an uncaught 23505 → 500).
    await tx.select({ id: boards.id }).from(boards).where(eq(boards.id, input.boardId)).for('update')

    // Append at the end. COALESCE handles the empty-board case (no rows).
    const [agg] = await tx
      .select({ next: sql<number>`COALESCE(MAX(${boardColumns.position}), -1) + 1` })
      .from(boardColumns)
      .where(eq(boardColumns.boardId, input.boardId))

    const [row] = await tx
      .insert(boardColumns)
      .values({
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        name: input.name,
        columnRole: input.columnRole,
        wipLimit: input.wipLimit,
        position: Number(agg!.next),
      })
      .returning()
    return row!
  })
}

export async function updateColumn(input: {
  workspaceId: string
  columnId: string
  patch: { name?: string; wipLimit?: number | null; columnRole?: ColumnRole }
  actorRole: WorkspaceMemberRole
}): Promise<BoardColumn> {
  requireMinRole(input.actorRole, 'admin')

  // Strip undefined keys so we never write SQL `NULL` for an unspecified field.
  // (wipLimit is intentionally allowed to be explicit-null — that means "no limit".)
  const set: Partial<typeof boardColumns.$inferInsert> = {}
  if (input.patch.name !== undefined) set.name = input.patch.name
  if (input.patch.wipLimit !== undefined) set.wipLimit = input.patch.wipLimit
  if (input.patch.columnRole !== undefined) set.columnRole = input.patch.columnRole

  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx.update(boardColumns).set(set).where(eq(boardColumns.id, input.columnId)).returning(),
  )
  if (!row) throw new NotFoundError('Колонка не найдена')
  return row
}

export async function deleteColumn(input: {
  workspaceId: string
  columnId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  try {
    const result = await withTenant(input.workspaceId, async (tx) =>
      tx.delete(boardColumns).where(eq(boardColumns.id, input.columnId)),
    )
    if ((result.count ?? 0) === 0) throw new NotFoundError('Колонка не найдена')
  } catch (err) {
    // tasks.column_id is ON DELETE RESTRICT: trying to drop a non-empty
    // column raises 23503 (foreign_key_violation). Translate to 422 with
    // a user-readable message instead of leaking the raw PG error.
    if (isPgFkViolation(err)) {
      throw new ValidationError('Нельзя удалить колонку, в которой есть задачи')
    }
    throw err
  }
}

// Atomic bulk reorder. Validates that the supplied id list is exactly the
// set of columns on the board, then renumbers in two phases to avoid hitting
// the (board_id, position) unique index during intermediate states.
export async function reorderColumns(input: {
  workspaceId: string
  boardId: string
  orderedIds: string[]
  actorRole: WorkspaceMemberRole
}): Promise<BoardColumn[]> {
  requireMinRole(input.actorRole, 'admin')

  if (new Set(input.orderedIds).size !== input.orderedIds.length) {
    throw new ValidationError('Список колонок не должен содержать дубликаты')
  }

  return withTenant(input.workspaceId, async (tx) => {
    const existing = await tx
      .select({ id: boardColumns.id })
      .from(boardColumns)
      .where(eq(boardColumns.boardId, input.boardId))
    const existingIds = new Set(existing.map((r) => r.id))

    if (input.orderedIds.length !== existing.length) {
      throw new ValidationError('Список должен содержать все колонки доски')
    }
    for (const id of input.orderedIds) {
      if (!existingIds.has(id)) {
        throw new ValidationError(`Неизвестный id колонки: ${id}`)
      }
    }

    // Phase 1: park all positions in a high range so the unique index
    // (board_id, position) is happy during the second-phase rewrites.
    await tx
      .update(boardColumns)
      .set({ position: sql`${boardColumns.position} + 10000` })
      .where(eq(boardColumns.boardId, input.boardId))

    // Phase 2: assign final positions one by one.
    for (let i = 0; i < input.orderedIds.length; i++) {
      await tx
        .update(boardColumns)
        .set({ position: i })
        .where(
          and(
            eq(boardColumns.id, input.orderedIds[i]!),
            eq(boardColumns.boardId, input.boardId),
          ),
        )
    }

    return tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.boardId, input.boardId))
      .orderBy(boardColumns.position)
  })
}

function isPgFkViolation(err: unknown): boolean {
  const candidate =
    typeof err === 'object' && err !== null && 'cause' in err
      ? (err as { cause?: unknown }).cause
      : err
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'code' in candidate &&
    candidate.code === PG_FK_VIOLATION
  )
}
