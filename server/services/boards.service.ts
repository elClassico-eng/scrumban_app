// BoardsService: CRUD over the boards table, all queries scoped through
// withTenant() so RLS at the DB layer enforces tenant isolation as a
// belt to the service-layer braces.
//
// Authorisation matrix (enforced here, not in handlers):
//   list/get  → viewer+
//   create    → admin+
//   update    → admin+
//   delete    → owner (destructive: cascades to columns + tasks + events)
import { and, eq, sql } from 'drizzle-orm'
import {
  boardColumns,
  boards,
  type Board,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import {
  ConflictError,
  NotFoundError,
} from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

const PG_UNIQUE_VIOLATION = '23505'

// Default board layout. New boards get these four columns auto-created so a
// freshly-made board is immediately usable. The user can rename or reorder
// them; column_role values stay so flow analytics remain meaningful even if
// the user-facing names diverge across teams.
const DEFAULT_COLUMNS = [
  { name: 'Backlog', columnRole: 'backlog' as const },
  { name: 'In Progress', columnRole: 'in_progress' as const },
  { name: 'Review', columnRole: 'review' as const },
  { name: 'Done', columnRole: 'done' as const },
]

export async function listBoards(
  workspaceId: string,
  actorRole: WorkspaceMemberRole,
): Promise<Board[]> {
  requireMinRole(actorRole, 'viewer')
  return withTenant(workspaceId, async (tx) => tx.select().from(boards))
}

export async function getBoard(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<Board> {
  requireMinRole(input.actorRole, 'viewer')
  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx.select().from(boards).where(eq(boards.id, input.boardId)),
  )
  if (!row) throw new NotFoundError('Доска не найдена')
  return row
}

export async function createBoard(input: {
  workspaceId: string
  name: string
  slug: string
  seedDefaults?: boolean
  actorRole: WorkspaceMemberRole
}): Promise<Board> {
  requireMinRole(input.actorRole, 'admin')
  try {
    return await withTenant(input.workspaceId, async (tx) => {
      const [row] = await tx
        .insert(boards)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          slug: input.slug,
        })
        .returning()

      // Seed default columns in the same transaction so a board never exists
      // without them when seedDefaults is on. If this insert fails, the board
      // insert rolls back too. seedDefaults=false lets a team start blank.
      if (input.seedDefaults !== false) {
        await tx.insert(boardColumns).values(
          DEFAULT_COLUMNS.map((c, position) => ({
            workspaceId: input.workspaceId,
            boardId: row!.id,
            name: c.name,
            columnRole: c.columnRole,
            position,
          })),
        )
      }

      return row!
    })
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Этот slug доски уже занят в workspace')
    }
    throw err
  }
}

export async function updateBoard(input: {
  workspaceId: string
  boardId: string
  patch: {
    name?: string
    slug?: string
    sleDays?: number | null
    sleProbability?: string
    replenishmentPeriodDays?: number
  }
  actorRole: WorkspaceMemberRole
}): Promise<Board> {
  requireMinRole(input.actorRole, 'admin')

  // Filter out undefined keys so we never overwrite a column with NULL.
  const set: {
    name?: string
    slug?: string
    sleDays?: number | null
    sleProbability?: string
    replenishmentPeriodDays?: number
    updatedAt: Date
  } = { updatedAt: new Date() }
  if (input.patch.name !== undefined) set.name = input.patch.name
  if (input.patch.slug !== undefined) set.slug = input.patch.slug
  if ('sleDays' in input.patch) set.sleDays = input.patch.sleDays ?? null
  if (input.patch.sleProbability !== undefined) set.sleProbability = input.patch.sleProbability
  if (input.patch.replenishmentPeriodDays !== undefined) {
    set.replenishmentPeriodDays = input.patch.replenishmentPeriodDays
  }

  try {
    const [row] = await withTenant(input.workspaceId, async (tx) =>
      tx
        .update(boards)
        .set(set)
        .where(and(eq(boards.id, input.boardId), eq(boards.workspaceId, input.workspaceId)))
        .returning(),
    )
    if (!row) throw new NotFoundError('Доска не найдена')
    return row
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Этот slug доски уже занят в workspace')
    }
    throw err
  }
}

export async function deleteBoard(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  // Owner-only: deleting a board cascades to columns, tasks and events.
  requireMinRole(input.actorRole, 'owner')
  const result = await withTenant(input.workspaceId, async (tx) =>
    tx.delete(boards).where(eq(boards.id, input.boardId)),
  )
  if ((result.count ?? 0) === 0) throw new NotFoundError('Доска не найдена')
}

function isPgUniqueViolation(err: unknown): boolean {
  const candidate =
    typeof err === 'object' && err !== null && 'cause' in err
      ? (err as { cause?: unknown }).cause
      : err
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'code' in candidate &&
    candidate.code === PG_UNIQUE_VIOLATION
  )
}

export async function recordReplenishment(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<Board> {
  requireMinRole(input.actorRole, 'admin')

  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx
      .update(boards)
      .set({ lastReplenishmentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(boards.id, input.boardId), eq(boards.workspaceId, input.workspaceId)))
      .returning(),
  )
  if (!row) throw new NotFoundError('Доска не найдена')
  return row
}

// computeAndStoreSLE — re-read 90 days of closed task cycle times for the
// given board and write the percentile value (in days) into boards.sle_days.
// sle_probability stays as-is on the board; the computation just reads it.
// Returns the new sle_days value (null when there are too few samples).
//
// Reused inside the /sle/recompute endpoint. Anyone calling this needs
// admin+ — it mutates board configuration that downstream aging-WIP
// visuals key off of.
export async function computeAndStoreSLE(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<{ sleDays: number | null; sampleCount: number }> {
  requireMinRole(input.actorRole, 'admin')

  // Lookback window matches the rest of analytics (Phase 3 default).
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const fromIso = ninetyDaysAgo.toISOString()
  const toIso = now.toISOString()

  // Read, compute and write all inside one tenant transaction: a bare
  // useDB() query carries no app.workspace_id, so under the NOBYPASSRLS app
  // role RLS returns zero rows (board read 404s; update touches nothing).
  return withTenant(input.workspaceId, async (tx) => {
    const [board] = await tx
      .select({ sleProbability: boards.sleProbability })
      .from(boards)
      .where(eq(boards.id, input.boardId))
    if (!board) throw new NotFoundError('Доска не найдена')

    // sleProbability arrives as a string from numeric(3,2); coerce.
    const probability = Number(board.sleProbability)

    const samples = await tx.execute<{ cycleHours: string }>(sql`
      WITH closed AS (
        SELECT e.task_id, e.created_at AS closed_at
        FROM task_events e
        JOIN tasks t ON t.id = e.task_id
        WHERE e.event_type = 'task_closed'
          AND t.board_id = ${input.boardId}
          AND e.created_at >= ${fromIso}::timestamptz
          AND e.created_at <= ${toIso}::timestamptz
      ),
      created AS (
        SELECT DISTINCT ON (e.task_id) e.task_id, e.created_at AS first_at
        FROM task_events e
        WHERE e.event_type = 'task_created'
        ORDER BY e.task_id, e.created_at ASC
      )
      SELECT
        EXTRACT(EPOCH FROM (c.closed_at - COALESCE(cr.first_at, t.created_at))) / 3600 AS "cycleHours"
      FROM closed c
      JOIN tasks t ON t.id = c.task_id
      LEFT JOIN created cr ON cr.task_id = c.task_id
      WHERE c.closed_at >= COALESCE(cr.first_at, t.created_at)
    `)

    const hoursArray = (samples as unknown as Array<{ cycleHours: string | number }>)
      .map((r) => Number(r.cycleHours))
      .sort((a, b) => a - b)

    // Min-sample guard mirrors analytics percentile threshold. Below this
    // count the percentile would just be noise — leave sle_days unchanged.
    const MIN_SAMPLES = 5
    if (hoursArray.length < MIN_SAMPLES) {
      return { sleDays: null, sampleCount: hoursArray.length }
    }

    // Linear-interpolation percentile over the sorted sample, then convert
    // hours → whole days, rounded up so SLE is conservative (we'd rather
    // over-promise time than mis-flag tasks as 'aging' too early).
    const idx = (probability * (hoursArray.length - 1))
    const lower = Math.floor(idx)
    const upper = Math.ceil(idx)
    const frac = idx - lower
    const valueHours = hoursArray[lower]! + frac * (hoursArray[upper]! - hoursArray[lower]!)
    const valueDays = Math.max(1, Math.ceil(valueHours / 24))

    await tx
      .update(boards)
      .set({ sleDays: valueDays, updatedAt: new Date() })
      .where(and(eq(boards.id, input.boardId), eq(boards.workspaceId, input.workspaceId)))

    return { sleDays: valueDays, sampleCount: hoursArray.length }
  })
}
