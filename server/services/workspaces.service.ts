// WorkspacesService: lifecycle of workspaces and the user-membership facts.
// All visibility decisions live here: list/get methods are scoped to a
// userId, so callers cannot accidentally expose data to non-members.
// (RLS will enforce the same rules at the DB layer in the next step;
// service-level guards remain as defence in depth.)
import { and, eq } from 'drizzle-orm'
import {
  workspaceMembers,
  workspaces,
  type Workspace,
  type WorkspaceMemberRole,
} from '../db/schema'
import { ConflictError, NotFoundError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

const PG_UNIQUE_VIOLATION = '23505'

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceMemberRole
}

export async function createWorkspace(input: {
  name: string
  slug: string
  ownerId: string
}): Promise<WorkspaceWithRole> {
  try {
    return await useDB().transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({ name: input.name, slug: input.slug })
        .returning()

      await tx.insert(workspaceMembers).values({
        workspaceId: ws!.id,
        userId: input.ownerId,
        role: 'owner',
      })

      return { ...ws!, role: 'owner' as const }
    })
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Workspace slug already taken')
    }
    throw err
  }
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]> {
  return useDB()
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
}

// Returns the workspace if the user is a member of it (with their role).
// Returns undefined if the workspace does not exist OR the user is not a member.
// We deliberately do not distinguish the two cases — that prevents leaking
// "this workspace exists but you cannot see it" via different status codes.
export async function findWorkspaceForUser(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceWithRole | undefined> {
  const [row] = await useDB()
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
  return row
}

export async function getWorkspaceForUserOrThrow(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceWithRole> {
  const ws = await findWorkspaceForUser(workspaceId, userId)
  if (!ws) throw new NotFoundError('Workspace not found')
  return ws
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

// Mutate workspace metadata. Currently only `name` is editable; the slug
// is part of every URL and renaming it would invalidate external links.
// Admin+ required so members/viewers cannot rewrite the workspace label.
export async function updateWorkspace(input: {
  workspaceId: string
  patch: { name?: string }
  actorRole: WorkspaceMemberRole
}): Promise<WorkspaceWithRole> {
  requireMinRole(input.actorRole, 'admin')

  const set: { name?: string; updatedAt: Date } = { updatedAt: new Date() }
  if (input.patch.name !== undefined) set.name = input.patch.name

  const [updated] = await useDB()
    .update(workspaces)
    .set(set)
    .where(eq(workspaces.id, input.workspaceId))
    .returning()

  if (!updated) throw new NotFoundError('Workspace not found')

  return { ...updated, role: input.actorRole }
}
