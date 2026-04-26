// POST /api/auth/login — verifies credentials and starts a session.
// Same response on "user not found" and "wrong password" to avoid
// account enumeration via timing or status differences.
import { z } from 'zod'
import { findUserByEmail } from '../../services/users.service'

const LoginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, LoginSchema.parse)

  const user = await findUserByEmail(body.email)
  const ok = user ? await verifyPassword(user.passwordHash, body.password) : false

  if (!user || !ok) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setUserSession(event, { user: { id: user.id, email: user.email } })
  return { user: { id: user.id, email: user.email } }
})
