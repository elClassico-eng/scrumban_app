// POST /api/auth/register — creates a new user and starts a session.
// Validates input with zod, hashes the password via nuxt-auth-utils
// hashPassword() — scrypt (Node-native, library default) — persists the
// user, and writes a signed session cookie.
import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'
import { createUser } from '../../services/users.service'
import { createVerification } from '../../services/email-verifications.service'
import { toHttpError } from '../../utils/errors'
import { sendVerificationEmail } from '../../utils/auth-emails'

const RegisterSchema = z.object({
  email: z.email().max(255),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  middleName: z.string().trim().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, RegisterSchema.parse)

  try {
    const passwordHash = await hashPassword(body.password)
    const user = await createUser({
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName,
    })

    await setUserSession(event, { user: { id: user.id, email: user.email } })

    // Verification email is best-effort: registration must not 500 if SMTP
    // is down. The user can request a resend via /api/auth/resend-verification.
    try {
      const { plainToken } = await createVerification(user.id)
      await sendVerificationEmail({
        to: user.email,
        recipientName: user.firstName ?? '',
        token: plainToken,
      })
    }
    catch (mailErr) {
      console.error('[register] failed to send verification email:', mailErr)
    }

    return { user: { id: user.id, email: user.email } }
  } catch (err) {
    throw toHttpError(err)
  }
})
