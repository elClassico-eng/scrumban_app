import { z } from 'zod'
import { findUserByEmail } from '../../../services/users.service'
import { createPasswordReset } from '../../../services/password-resets.service'
import { sendPasswordResetEmail } from '../../../utils/auth-emails'
import { toHttpError } from '../../../utils/errors'

const ForgotSchema = z.object({
  email: z.email().max(255),
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, ForgotSchema.parse)
    const user = await findUserByEmail(body.email)

    if (user) {
      try {
        const { plainToken } = await createPasswordReset(user.id)
        await sendPasswordResetEmail({
          to: user.email,
          recipientName: user.firstName ?? '',
          token: plainToken,
        })
      }
      catch (mailErr) {
        console.error('[password/forgot] failed to send reset email:', mailErr)
      }
    }

    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
