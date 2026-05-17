import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { passwordResets } from '../../../../db/schema'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
})

export default defineEventHandler(async (event) => {
  try {
    const { token } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const [row] = await useDB()
      .select({
        usedAt: passwordResets.usedAt,
        expiresAt: passwordResets.expiresAt,
      })
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, tokenHash))
      .limit(1)

    if (!row) return { valid: false, reason: 'not_found' as const }
    if (row.usedAt) return { valid: false, reason: 'already_used' as const }
    if (row.expiresAt.getTime() < Date.now()) return { valid: false, reason: 'expired' as const }
    return { valid: true as const }
  }
  catch (err) {
    throw toHttpError(err)
  }
})