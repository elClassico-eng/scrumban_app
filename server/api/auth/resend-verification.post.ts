import { findUserById } from '../../services/users.service'
import { createVerification } from '../../services/email-verifications.service'
import { requireAuth } from '../../utils/auth'
import { sendVerificationEmail } from '../../utils/auth-emails'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const user = await findUserById(sessionUser.id)
    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }
    if (user.emailVerifiedAt) {
      return { ok: true, alreadyVerified: true }
    }

    const { plainToken } = await createVerification(user.id)
    await sendVerificationEmail({
      to: user.email,
      recipientName: user.firstName ?? '',
      token: plainToken,
    })
    return { ok: true, alreadyVerified: false }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
