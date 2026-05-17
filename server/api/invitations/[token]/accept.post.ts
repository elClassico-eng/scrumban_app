import { z } from 'zod'
import { findUserById } from '../../../services/users.service'
import { acceptInvitation } from '../../../services/workspace-invitations.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
})

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const { token } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const user = await findUserById(sessionUser.id)
    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const result = await acceptInvitation({
      plainToken: token,
      userId: user.id,
      userEmail: user.email,
      userEmailVerified: user.emailVerifiedAt !== null,
    })

    if (!result.ok) {
      const statusCode
        = result.reason === 'expired' ? 410
          : result.reason === 'email_mismatch' ? 403
            : result.reason === 'email_not_verified' ? 403
              : 400
      const message
        = result.reason === 'expired' ? 'Приглашение истекло.'
          : result.reason === 'already_used' ? 'Приглашение уже использовано.'
            : result.reason === 'email_mismatch' ? 'Приглашение выписано на другой email.'
              : result.reason === 'email_not_verified' ? 'Сначала подтвердите свой email.'
                : 'Приглашение недействительно.'
      throw createError({
        statusCode,
        statusMessage: message,
        data: { message, reason: result.reason },
      })
    }

    return {
      ok: true,
      workspaceId: result.workspaceId,
      alreadyMember: result.alreadyMember,
      currentRole: result.currentRole,
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})