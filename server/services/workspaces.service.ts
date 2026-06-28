// WorkspacesService: lifecycle of workspaces and the user-membership facts.
// All visibility decisions live here: list/get methods are scoped to a
// userId, so callers cannot accidentally expose data to non-members.
// (RLS will enforce the same rules at the DB layer in the next step;
// service-level guards remain as defence in depth.)
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import {
  workspaceMembers,
  workspaceUserLabels,
  workspaces,
  type Workspace,
  type WorkspaceCardStyle,
  type WorkspaceMemberRole,
} from '../db/schema'
import { NotFoundError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceMemberRole
}

export type WorkspaceListItem = WorkspaceWithRole & {
  myLabel: string | null
  boardCount: number
  openTaskCount: number
  memberCount: number
}

type Tx = Parameters<Parameters<ReturnType<typeof useDB>['transaction']>[0]>[0]

export interface CreateWorkspaceInput {
  name: string
  slug: string
  ownerId: string
  description?: string | null
  purpose?: string | null
  industry?: string | null
}

export async function createWorkspaceInTx(
  tx: Tx,
  input: CreateWorkspaceInput,
): Promise<WorkspaceWithRole> {
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
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceWithRole> {
  return useDB().transaction(tx => createWorkspaceInTx(tx, input))
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
  cardStyle: workspaces.cardStyle,
  createdAt: workspaces.createdAt,
  updatedAt: workspaces.updatedAt,
  role: workspaceMembers.role,
} as const

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceListItem[]> {
  return withUser(userId, async (tx) => {
    const rows = await tx
      .select({ ...workspaceWithRoleSelect, myLabel: workspaceUserLabels.label })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .leftJoin(
        workspaceUserLabels,
        and(
          eq(workspaceUserLabels.workspaceId, workspaceMembers.workspaceId),
          eq(workspaceUserLabels.userId, userId),
        ),
      )
      .where(eq(workspaceMembers.userId, userId))

    const ids = rows.map(r => r.id)
    if (ids.length === 0) return []

    const memberCounts = await tx
      .select({ workspaceId: workspaceMembers.workspaceId, n: count() })
      .from(workspaceMembers)
      .where(inArray(workspaceMembers.workspaceId, ids))
      .groupBy(workspaceMembers.workspaceId)
    const byMembers = new Map(
      memberCounts.map(r => [r.workspaceId, Number(r.n)] as [string, number]),
    )

    // boards/tasks are tenant-isolated by app.workspace_id (see withTenant),
    // so they can't be aggregated across workspaces in one query — count per
    // workspace by switching the tenant GUC inside this same transaction.
    const byBoards = new Map<string, number>()
    const byOpenTasks = new Map<string, number>()
    for (const id of ids) {
      await tx.execute(sql`SELECT set_config('app.workspace_id', ${id}, true)`)
      const res = (await tx.execute(sql`
        SELECT
          (SELECT count(*)::int FROM boards) AS boards,
          (SELECT count(*)::int FROM tasks WHERE closed_at IS NULL) AS open_tasks
      `)) as unknown as { boards: number; open_tasks: number }[]
      byBoards.set(id, res[0]?.boards ?? 0)
      byOpenTasks.set(id, res[0]?.open_tasks ?? 0)
    }

    return rows.map(r => ({
      ...r,
      boardCount: byBoards.get(r.id) ?? 0,
      openTaskCount: byOpenTasks.get(r.id) ?? 0,
      memberCount: byMembers.get(r.id) ?? 0,
    }))
  })
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
    cardStyle?: WorkspaceCardStyle
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
  if (input.patch.cardStyle !== undefined) set.cardStyle = input.patch.cardStyle

  const [updated] = await useDB()
    .update(workspaces)
    .set(set)
    .where(eq(workspaces.id, input.workspaceId))
    .returning()

  if (!updated) throw new NotFoundError('Workspace не найден')

  return { ...updated, role: input.actorRole }
}

export async function deleteWorkspace(input: {
  workspaceId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'owner')

  const result = await useDB()
    .delete(workspaces)
    .where(eq(workspaces.id, input.workspaceId))

  if ((result.count ?? 0) === 0) throw new NotFoundError('Workspace не найден')
}

export async function setWorkspaceLabel(input: {
  workspaceId: string
  userId: string
  label: string | null
}): Promise<{ label: string | null }> {
  return withUser(input.userId, async (tx) => {
    const trimmed = input.label?.trim() ?? ''
    if (trimmed === '') {
      await tx
        .delete(workspaceUserLabels)
        .where(
          and(
            eq(workspaceUserLabels.userId, input.userId),
            eq(workspaceUserLabels.workspaceId, input.workspaceId),
          ),
        )
      return { label: null }
    }
    await tx
      .insert(workspaceUserLabels)
      .values({ userId: input.userId, workspaceId: input.workspaceId, label: trimmed })
      .onConflictDoUpdate({
        target: [workspaceUserLabels.userId, workspaceUserLabels.workspaceId],
        set: { label: trimmed },
      })
    return { label: trimmed }
  })
}
