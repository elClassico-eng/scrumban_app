import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { passwordResets, users } from '../db/schema'

const TOKEN_BYTES = 32
const TTL_MS = 60 * 60 * 1000

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

export type CreatePasswordResetResult = {
  plainToken: string
  expiresAt: Date
}

export async function createPasswordReset(userId: string): Promise<CreatePasswordResetResult> {
  const plainToken = randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + TTL_MS)
  await useDB().insert(passwordResets).values({ userId, tokenHash, expiresAt })
  return { plainToken, expiresAt }
}

export type ConsumePasswordResetResult =
  | { ok: true, userId: string }
  | { ok: false, reason: 'not_found' | 'expired' | 'already_used' }

export async function consumePasswordReset(
  plainToken: string,
  newPasswordHash: string,
): Promise<ConsumePasswordResetResult> {
  const tokenHash = hashToken(plainToken)
  const [row] = await useDB()
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, tokenHash))
    .limit(1)

  if (!row) return { ok: false, reason: 'not_found' }
  if (row.usedAt) return { ok: false, reason: 'already_used' }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }

  const now = new Date()
  await useDB().transaction(async (tx) => {
    await tx
      .update(passwordResets)
      .set({ usedAt: now })
      .where(eq(passwordResets.id, row.id))
    await tx
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: now })
      .where(eq(users.id, row.userId))
  })
  return { ok: true, userId: row.userId }
}
