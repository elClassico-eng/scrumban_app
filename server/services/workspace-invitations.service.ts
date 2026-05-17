import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import {
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  users,
  type WorkspaceInvitation,
  type WorkspaceMemberRole,
} from '../db/schema'
import {
  ForbiddenError,
  NotFoundError,
} from '../utils/errors'
import { requireMinRole, strictlyOutranks } from '../utils/rbac'

const TOKEN_BYTES = 32
const TTL_MS = 7 * 24 * 60 * 60 * 1000

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type InvitationListItem = {
  id: string
  role: WorkspaceMemberRole
  email: string | null
  createdAt: Date
  expiresAt: Date
  createdByEmail: string
  token: never
}

export type InvitationCreateResult = {
  invitation: WorkspaceInvitation
  plainToken: string
}

export async function createInvitation(input: {
  workspaceId: string
  role: WorkspaceMemberRole
  email: string | null
  createdBy: string
  actorRole: WorkspaceMemberRole
}): Promise<InvitationCreateResult> {
  requireMinRole(input.actorRole, 'admin')
  if (!strictlyOutranks(input.actorRole, input.role)) {
    throw new ForbiddenError('Нельзя выдать роль выше своей или равную своей')
  }

  const email = input.email ? normaliseEmail(input.email) : null
  const plainToken = randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + TTL_MS)

  const [row] = await useDB()
    .insert(workspaceInvitations)
    .values({
      workspaceId: input.workspaceId,
      tokenHash,
      role: input.role,
      email,
      createdBy: input.createdBy,
      expiresAt,
    })
    .returning()

  return { invitation: row!, plainToken }
}

export async function listActiveInvitations(input: {
  workspaceId: string
  actorRole: WorkspaceMemberRole
}) {
  requireMinRole(input.actorRole, 'admin')
  return useDB()
    .select({
      id: workspaceInvitations.id,
      role: workspaceInvitations.role,
      email: workspaceInvitations.email,
      createdAt: workspaceInvitations.createdAt,
      expiresAt: workspaceInvitations.expiresAt,
      createdByEmail: users.email,
    })
    .from(workspaceInvitations)
    .innerJoin(users, eq(users.id, workspaceInvitations.createdBy))
    .where(
      and(
        eq(workspaceInvitations.workspaceId, input.workspaceId),
        isNull(workspaceInvitations.usedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(workspaceInvitations.createdAt)
}

export async function cancelInvitation(input: {
  workspaceId: string
  invitationId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  const result = await useDB()
    .delete(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.id, input.invitationId),
        eq(workspaceInvitations.workspaceId, input.workspaceId),
      ),
    )
    .returning({ id: workspaceInvitations.id })
  if (result.length === 0) {
    throw new NotFoundError('Приглашение не найдено')
  }
}

export type InvitationInspectResult =
  | {
      valid: true
      workspaceName: string
      role: WorkspaceMemberRole
      emailBound: string | null
    }
  | { valid: false, reason: 'not_found' | 'expired' | 'already_used' }

export async function inspectInvitationByToken(plainToken: string): Promise<InvitationInspectResult> {
  const tokenHash = hashToken(plainToken)
  const [row] = await useDB()
    .select({
      usedAt: workspaceInvitations.usedAt,
      expiresAt: workspaceInvitations.expiresAt,
      role: workspaceInvitations.role,
      email: workspaceInvitations.email,
      workspaceName: workspaces.name,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .where(eq(workspaceInvitations.tokenHash, tokenHash))
    .limit(1)

  if (!row) return { valid: false, reason: 'not_found' }
  if (row.usedAt) return { valid: false, reason: 'already_used' }
  if (row.expiresAt.getTime() < Date.now()) return { valid: false, reason: 'expired' }
  return {
    valid: true,
    workspaceName: row.workspaceName,
    role: row.role,
    emailBound: row.email,
  }
}

export type AcceptResult =
  | { ok: true, workspaceId: string, alreadyMember: boolean, currentRole: WorkspaceMemberRole }
  | { ok: false, reason: 'not_found' | 'expired' | 'already_used' | 'email_mismatch' | 'email_not_verified' }

export async function acceptInvitation(input: {
  plainToken: string
  userId: string
  userEmail: string
  userEmailVerified: boolean
}): Promise<AcceptResult> {
  const tokenHash = hashToken(input.plainToken)
  const [invite] = await useDB()
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.tokenHash, tokenHash))
    .limit(1)

  if (!invite) return { ok: false, reason: 'not_found' }
  if (invite.usedAt) return { ok: false, reason: 'already_used' }
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }
  if (invite.email && normaliseEmail(invite.email) !== normaliseEmail(input.userEmail)) {
    return { ok: false, reason: 'email_mismatch' }
  }
  // Email-bound invitations require a verified email — otherwise someone
  // who intercepted the link (or registered under the targeted email
  // without confirming ownership) could accept on behalf of the rightful
  // recipient. Open links (invite.email == null) skip this check by design.
  if (invite.email && !input.userEmailVerified) {
    return { ok: false, reason: 'email_not_verified' }
  }

  const [existingMember] = await useDB()
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.userId, input.userId),
      ),
    )
    .limit(1)

  const now = new Date()
  await useDB().transaction(async (tx) => {
    if (!existingMember) {
      await tx
        .insert(workspaceMembers)
        .values({
          workspaceId: invite.workspaceId,
          userId: input.userId,
          role: invite.role,
        })
    }
    await tx
      .update(workspaceInvitations)
      .set({ usedAt: now })
      .where(eq(workspaceInvitations.id, invite.id))
  })

  return {
    ok: true,
    workspaceId: invite.workspaceId,
    alreadyMember: !!existingMember,
    currentRole: existingMember?.role ?? invite.role,
  }
}

export async function listPendingInvitationsForEmail(email: string) {
  const normalised = normaliseEmail(email)
  return useDB()
    .select({
      id: workspaceInvitations.id,
      role: workspaceInvitations.role,
      workspaceId: workspaceInvitations.workspaceId,
      workspaceName: workspaces.name,
      createdAt: workspaceInvitations.createdAt,
      expiresAt: workspaceInvitations.expiresAt,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .where(
      and(
        eq(workspaceInvitations.email, normalised),
        isNull(workspaceInvitations.usedAt),
        gt(workspaceInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(workspaceInvitations.createdAt)
}

// Accept-by-id flow: user discovered the invitation via /api/me/invitations
// (no plain-token available — we store only the hash). Ownership is proven
// by auth + email match + verified email instead of token possession.
export async function acceptInvitationById(input: {
  invitationId: string
  userId: string
  userEmail: string
  userEmailVerified: boolean
}): Promise<AcceptResult> {
  const [invite] = await useDB()
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.id, input.invitationId))
    .limit(1)

  if (!invite) return { ok: false, reason: 'not_found' }
  if (invite.usedAt) return { ok: false, reason: 'already_used' }
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }
  if (!invite.email) return { ok: false, reason: 'email_mismatch' }
  if (normaliseEmail(invite.email) !== normaliseEmail(input.userEmail)) {
    return { ok: false, reason: 'email_mismatch' }
  }
  if (!input.userEmailVerified) {
    return { ok: false, reason: 'email_not_verified' }
  }

  const [existingMember] = await useDB()
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.userId, input.userId),
      ),
    )
    .limit(1)

  const now = new Date()
  await useDB().transaction(async (tx) => {
    if (!existingMember) {
      await tx
        .insert(workspaceMembers)
        .values({
          workspaceId: invite.workspaceId,
          userId: input.userId,
          role: invite.role,
        })
    }
    await tx
      .update(workspaceInvitations)
      .set({ usedAt: now })
      .where(eq(workspaceInvitations.id, invite.id))
  })

  return {
    ok: true,
    workspaceId: invite.workspaceId,
    alreadyMember: !!existingMember,
    currentRole: existingMember?.role ?? invite.role,
  }
}