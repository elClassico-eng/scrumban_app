import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { emailVerifications, users, type EmailVerification } from '../db/schema'

const TOKEN_BYTES = 32
const TTL_MS = 24 * 60 * 60 * 1000

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

export type CreateVerificationResult = {
  plainToken: string
  expiresAt: Date
}

export async function createVerification(userId: string): Promise<CreateVerificationResult> {
  const plainToken = randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + TTL_MS)
  await useDB().insert(emailVerifications).values({ userId, tokenHash, expiresAt })
  return { plainToken, expiresAt }
}

export type ConsumeResult =
  | { ok: true, userId: string }
  | { ok: false, reason: 'not_found' | 'expired' | 'already_used' }

export async function consumeVerification(plainToken: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(plainToken)
  const [row] = await useDB()
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.tokenHash, tokenHash))
    .limit(1)

  if (!row) return { ok: false, reason: 'not_found' }
  if (row.usedAt) return { ok: false, reason: 'already_used' }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }

  const now = new Date()
  await useDB().transaction(async (tx) => {
    await tx
      .update(emailVerifications)
      .set({ usedAt: now })
      .where(eq(emailVerifications.id, row.id))
    await tx
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, row.userId))
  })
  return { ok: true, userId: row.userId }
}

export async function findActiveVerificationForUser(userId: string): Promise<EmailVerification | undefined> {
  const [row] = await useDB()
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.userId, userId))
    .limit(1)
  return row
}
