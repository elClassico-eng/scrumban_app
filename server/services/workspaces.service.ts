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
import { NotFoundError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceMemberRole
}

export async function createWorkspace(input: {
  name: string
  slug: string
  ownerId: string
  description?: string | null
  purpose?: string | null
  industry?: string | null
}): Promise<WorkspaceWithRole> {
  return useDB().transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspaces)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        purpose: input.purpose ?? null,
        industry: input.industry ?? null,
      })
      .returning()

    await tx.insert(workspaceMembers).values({
      workspaceId: ws!.id,
      userId: input.ownerId,
      role: 'owner',
    })

    return { ...ws!, role: 'owner' as const }
  })
}

// Selects every workspace column plus the role from the join — keeps the
// shape in sync with the schema automatically as we add fields (avoids
// per-column listing repeated across two functions).
const workspaceWithRoleSelect = {
  id: workspaces.id,
  name: workspaces.name,
  slug: workspaces.slug,
  description: workspaces.description,
  purpose: workspaces.purpose,
  industry: workspaces.industry,
  logoUrl: workspaces.logoUrl,
  createdAt: workspaces.createdAt,
  updatedAt: workspaces.updatedAt,
  role: workspaceMembers.role,
} as const

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]> {
  return useDB()
    .select(workspaceWithRoleSelect)
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
    .select(workspaceWithRoleSelect)
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
  if (!ws) throw new NotFoundError('Workspace не найден')
  return ws
}

// Mutate workspace metadata. Currently only `name` is editable; the slug
// is part of every URL and renaming it would invalidate external links.
// Admin+ required so members/viewers cannot rewrite the workspace label.
export async function updateWorkspace(input: {
  workspaceId: string
  patch: {
    name?: string
    description?: string | null
    purpose?: string | null
    industry?: string | null
    logoUrl?: string | null
  }
  actorRole: WorkspaceMemberRole
}): Promise<WorkspaceWithRole> {
  requireMinRole(input.actorRole, 'admin')

  const set: Partial<typeof workspaces.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if (input.patch.name !== undefined) set.name = input.patch.name
  if ('description' in input.patch) set.description = input.patch.description ?? null
  if ('purpose' in input.patch) set.purpose = input.patch.purpose ?? null
  if ('industry' in input.patch) set.industry = input.patch.industry ?? null
  if ('logoUrl' in input.patch) set.logoUrl = input.patch.logoUrl ?? null

  const [updated] = await useDB()
    .update(workspaces)
    .set(set)
    .where(eq(workspaces.id, input.workspaceId))
    .returning()

  if (!updated) throw new NotFoundError('Workspace не найден')

  return { ...updated, role: input.actorRole }
}
