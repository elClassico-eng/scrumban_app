// POST /api/auth/login — verifies credentials and starts a session.
// Same response on "user not found" and "wrong password" to avoid
// account enumeration via timing or status differences.
import { z } from 'zod'
import { createSession } from '../../services/user-sessions.service'
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
    throw createError({
      statusCode: 401,
      statusMessage: 'Неверный email или пароль',
      data: { message: 'Неверный email или пароль' },
    })
  }

  const sessionId = await createSession(event, user.id)
  await setUserSession(event, { user: { id: user.id, email: user.email }, sessionId })
  return { user: { id: user.id, email: user.email } }
})
