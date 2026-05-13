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
  firstName: string | null
  lastName: string | null
  middleName: string | null
  avatarUrl: string | null
  jobTitle: string | null
  role: WorkspaceMemberRole
  createdAt: Date
}

// Profile columns are projected here so the frontend can render avatars
// and display names everywhere members surface (cards, timelines, drawer
// assignee picker) from a single roster query.
const memberSelect = {
  userId: workspaceMembers.userId,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  middleName: users.middleName,
  avatarUrl: users.avatarUrl,
  jobTitle: users.jobTitle,
  role: workspaceMembers.role,
  createdAt: workspaceMembers.createdAt,
} as const

export async function listWorkspaceMembers(
  workspaceId: string,
  actorRole: WorkspaceMemberRole,
): Promise<MemberView[]> {
  // Anyone with at least viewer access can see the roster.
  requireMinRole(actorRole, 'viewer')

  return useDB()
    .select(memberSelect)
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
    throw new ForbiddenError('Нельзя выдать роль выше своей или равную своей')
  }

  const normalisedEmail = input.email.trim().toLowerCase()
  const [user] = await useDB()
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalisedEmail))

  if (!user) {
    throw new NotFoundError('Пользователь с таким email не зарегистрирован')
  }

  try {
    await useDB()
      .insert(workspaceMembers)
      .values({ workspaceId: input.workspaceId, userId: user.id, role: input.role })
    const view = await findMemberView(input.workspaceId, user.id)
    if (!view) throw new NotFoundError('Не удалось прочитать добавленного участника')
    return view
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Пользователь уже состоит в этом workspace')
    }
    throw err
  }
}

async function findMemberView(
  workspaceId: string,
  userId: string,
): Promise<MemberView | undefined> {
  const [row] = await useDB()
    .select(memberSelect)
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
  return row
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
  if (!target) throw new NotFoundError('Участник не найден в этом workspace')

  // You can't promote anyone (including yourself) to a role above your own.
  if (!roleAtLeast(input.actorRole, input.newRole)) {
    throw new ForbiddenError('Нельзя выдать роль выше своей')
  }

  // For OTHER members, actor must strictly outrank the target's current role.
  // Self-modification is allowed (e.g. an owner demoting themselves) and is
  // bounded only by the "last remaining owner" guard below.
  const isSelf = input.actorUserId === input.targetUserId
  if (!isSelf && !strictlyOutranks(input.actorRole, target.role)) {
    throw new ForbiddenError('Нельзя изменять участника с равной или более высокой ролью')
  }

  // Demoting the last remaining owner would orphan the workspace.
  if (target.role === 'owner' && input.newRole !== 'owner') {
    await assertNotLastOwner(input.workspaceId, input.targetUserId)
  }

  await useDB()
    .update(workspaceMembers)
    .set({ role: input.newRole })
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    )

  const view = await findMemberView(input.workspaceId, input.targetUserId)
  if (!view) throw new NotFoundError('Не удалось прочитать обновлённого участника')
  return view
}

export async function removeMember(input: {
  workspaceId: string
  targetUserId: string
  actorRole: WorkspaceMemberRole
  actorUserId: string
}): Promise<void> {
  const target = await findMemberRow(input.workspaceId, input.targetUserId)
  if (!target) throw new NotFoundError('Участник не найден в этом workspace')

  // Self-removal is always allowed (any role can leave). Removing someone
  // else requires admin+ AND strict outranking.
  const removingSelf = input.actorUserId === input.targetUserId
  if (!removingSelf) {
    requireMinRole(input.actorRole, 'admin')
    if (!strictlyOutranks(input.actorRole, target.role)) {
      throw new ForbiddenError('Нельзя удалить участника с равной или более высокой ролью')
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
      `Это последний владелец workspace — сначала назначь другого владельца (user ${candidateUserId})`,
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
