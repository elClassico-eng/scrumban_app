// WorkspaceMembersService: read + administer the workspace_members rows.
//
// All write operations enforce two layers of authorisation:
//   1. The actor must have at least 'admin' role in the target workspace.
//   2. The actor must strictly outrank the target row's role. This prevents
//      an admin from demoting/removing an owner, and stops any non-owner
//      from creating new owners.
//
// We never look up users by id without bounding them to a workspace —
// that's how cross-tenant info leaks happen.
import { and, eq, sql } from 'drizzle-orm'
import {
  users,
  workspaceMembers,
  type WorkspaceMemberRole,
} from '../db/schema'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors'
import { requireMinRole, roleAtLeast, strictlyOutranks } from '../utils/rbac'

export interface MemberView {
  userId: string
  email: string
  role: WorkspaceMemberRole
  createdAt: Date
}

export async function listWorkspaceMembers(
  workspaceId: string,
  actorRole: WorkspaceMemberRole,
): Promise<MemberView[]> {
  // Anyone with at least viewer access can see the roster.
  requireMinRole(actorRole, 'viewer')

  return useDB()
    .select({
      userId: workspaceMembers.userId,
      email: users.email,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
}

export async function addMemberByEmail(input: {
  workspaceId: string
  email: string
  role: WorkspaceMemberRole
  actorRole: WorkspaceMemberRole
}): Promise<MemberView> {
  requireMinRole(input.actorRole, 'admin')
  if (!strictlyOutranks(input.actorRole, input.role)) {
    throw new ForbiddenError('Cannot grant a role equal to or above your own')
  }

  const normalisedEmail = input.email.trim().toLowerCase()
  const [user] = await useDB()
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalisedEmail))

  if (!user) {
    throw new NotFoundError('User with that email is not registered')
  }

  try {
    const [row] = await useDB()
      .insert(workspaceMembers)
      .values({ workspaceId: input.workspaceId, userId: user.id, role: input.role })
      .returning()
    return {
      userId: row!.userId,
      email: user.email,
      role: row!.role,
      createdAt: row!.createdAt,
    }
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('User is already a member of this workspace')
    }
    throw err
  }
}

export async function updateMemberRole(input: {
  workspaceId: string
  targetUserId: string
  newRole: WorkspaceMemberRole
  actorRole: WorkspaceMemberRole
  actorUserId: string
}): Promise<MemberView> {
  requireMinRole(input.actorRole, 'admin')

  const target = await findMemberRow(input.workspaceId, input.targetUserId)
  if (!target) throw new NotFoundError('Member not found in this workspace')

  // You can't promote anyone (including yourself) to a role above your own.
  if (!roleAtLeast(input.actorRole, input.newRole)) {
    throw new ForbiddenError('Cannot grant a role above your own')
  }

  // For OTHER members, actor must strictly outrank the target's current role.
  // Self-modification is allowed (e.g. an owner demoting themselves) and is
  // bounded only by the "last remaining owner" guard below.
  const isSelf = input.actorUserId === input.targetUserId
  if (!isSelf && !strictlyOutranks(input.actorRole, target.role)) {
    throw new ForbiddenError('Cannot modify a member of equal or higher rank')
  }

  // Demoting the last remaining owner would orphan the workspace.
  if (target.role === 'owner' && input.newRole !== 'owner') {
    await assertNotLastOwner(input.workspaceId, input.targetUserId)
  }

  const [updated] = await useDB()
    .update(workspaceMembers)
    .set({ role: input.newRole })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    )
    .returning()

  const [user] = await useDB()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.targetUserId))

  return {
    userId: updated!.userId,
    email: user!.email,
    role: updated!.role,
    createdAt: updated!.createdAt,
  }
}

export async function removeMember(input: {
  workspaceId: string
  targetUserId: string
  actorRole: WorkspaceMemberRole
  actorUserId: string
}): Promise<void> {
  const target = await findMemberRow(input.workspaceId, input.targetUserId)
  if (!target) throw new NotFoundError('Member not found in this workspace')

  // Self-removal is always allowed (any role can leave). Removing someone
  // else requires admin+ AND strict outranking.
  const removingSelf = input.actorUserId === input.targetUserId
  if (!removingSelf) {
    requireMinRole(input.actorRole, 'admin')
    if (!strictlyOutranks(input.actorRole, target.role)) {
      throw new ForbiddenError('Cannot remove a member of equal or higher rank')
    }
  }
  if (target.role === 'owner') {
    await assertNotLastOwner(input.workspaceId, input.targetUserId)
  }

  await useDB()
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    )
}

async function findMemberRow(workspaceId: string, userId: string) {
  const [row] = await useDB()
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
  return row
}

async function assertNotLastOwner(workspaceId: string, candidateUserId: string): Promise<void> {
  const rows = await useDB()
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, 'owner'),
      ),
    )
  // count includes the candidate; if it's exactly 1 they are the last owner.
  const count = rows[0]?.count ?? 0
  if (count <= 1) {
    throw new ValidationError(
      `User ${candidateUserId} is the only owner; promote another owner first`,
    )
  }
}

const PG_UNIQUE_VIOLATION = '23505'
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
