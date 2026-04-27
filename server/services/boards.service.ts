// BoardsService: CRUD over the boards table, all queries scoped through
// withTenant() so RLS at the DB layer enforces tenant isolation as a
// belt to the service-layer braces.
//
// Authorisation matrix (enforced here, not in handlers):
//   list/get  → viewer+
//   create    → admin+
//   update    → admin+
//   delete    → owner (destructive: cascades to columns + tasks + events)
import { and, eq } from 'drizzle-orm'
import { boards, type Board, type WorkspaceMemberRole } from '../db/schema'
import { withTenant } from '../utils/db'
import {
  ConflictError,
  NotFoundError,
} from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

const PG_UNIQUE_VIOLATION = '23505'

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
  if (!row) throw new NotFoundError('Board not found')
  return row
}

export async function createBoard(input: {
  workspaceId: string
  name: string
  slug: string
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
      return row!
    })
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Board slug already taken in this workspace')
    }
    throw err
  }
}

export async function updateBoard(input: {
  workspaceId: string
  boardId: string
  patch: { name?: string; slug?: string }
  actorRole: WorkspaceMemberRole
}): Promise<Board> {
  requireMinRole(input.actorRole, 'admin')

  // Filter out undefined keys so we never overwrite a column with NULL.
  const set: { name?: string; slug?: string; updatedAt: Date } = { updatedAt: new Date() }
  if (input.patch.name !== undefined) set.name = input.patch.name
  if (input.patch.slug !== undefined) set.slug = input.patch.slug

  try {
    const [row] = await withTenant(input.workspaceId, async (tx) =>
      tx
        .update(boards)
        .set(set)
        .where(and(eq(boards.id, input.boardId), eq(boards.workspaceId, input.workspaceId)))
        .returning(),
    )
    if (!row) throw new NotFoundError('Board not found')
    return row
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Board slug already taken in this workspace')
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
  if ((result.count ?? 0) === 0) throw new NotFoundError('Board not found')
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
