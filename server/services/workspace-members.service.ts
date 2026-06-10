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
import { and, eq } from 'drizzle-orm'
import {
  users,
  workspaceMembers,
  type WorkspaceMemberRole,
} from '../db/schema'
import type { DbTransaction } from '../utils/db'
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

  // Cannot grant a role above your own. Only owners may grant a role EQUAL
  // to their own (appointing a co-owner); everyone else must strictly
  // outrank the granted role — matching the invite/add paths, so the admin
  // tier can't self-expand by minting peer admins.
  const canGrantRole = input.actorRole === 'owner'
    ? roleAtLeast(input.actorRole, input.newRole)
    : strictlyOutranks(input.actorRole, input.newRole)
  if (!canGrantRole) {
    throw new ForbiddenError('Нельзя выдать роль выше своей или равную своей')
  }

  // For OTHER members, actor must strictly outrank the target's current role.
  // Self-modification is allowed (e.g. an owner demoting themselves) and is
  // bounded only by the "last remaining owner" guard below.
  const isSelf = input.actorUserId === input.targetUserId
  if (!isSelf && !strictlyOutranks(input.actorRole, target.role)) {
    throw new ForbiddenError('Нельзя изменять участника с равной или более высокой ролью')
  }

  // Lock owners + recount + write in one transaction so a concurrent
  // demotion/removal of a different owner can't also slip past the
  // last-owner guard and orphan the workspace.
  await useDB().transaction(async (tx) => {
    if (target.role === 'owner' && input.newRole !== 'owner') {
      await assertNotLastOwner(tx, input.workspaceId, input.targetUserId)
    }
    await tx
      .update(workspaceMembers)
      .set({ role: input.newRole })
      .where(
        and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.userId, input.targetUserId),
        ),
      )
  })

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
  await useDB().transaction(async (tx) => {
    if (target.role === 'owner') {
      await assertNotLastOwner(tx, input.workspaceId, input.targetUserId)
    }
    await tx
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.userId, input.targetUserId),
        ),
      )
  })
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

async function assertNotLastOwner(
  tx: DbTransaction,
  workspaceId: string,
  candidateUserId: string,
): Promise<void> {
  // SELECT ... FOR UPDATE locks the workspace's owner rows so two concurrent
  // demotions/removals of different owners serialize here — the second waits,
  // then sees the post-commit set and can't also drop the last owner.
  // (count(*) can't be combined with FOR UPDATE, so we lock the rows and
  // count them in JS.)
  const owners = await tx
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, 'owner'),
      ),
    )
    .for('update')
  // owners includes the candidate; if it's the only one they are the last.
  if (owners.length <= 1) {
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
