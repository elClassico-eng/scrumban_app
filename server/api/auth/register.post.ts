// POST /api/auth/register — creates a new user and starts a session.
// Validates input with zod, hashes the password via nuxt-auth-utils
// hashPassword() — scrypt (Node-native, library default) — persists the
// user, and writes a signed session cookie.
import { z } from 'zod'
import { createUser } from '../../services/users.service'
import { toHttpError } from '../../utils/errors'

const RegisterSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(8).max(128),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, RegisterSchema.parse)

  try {
    const passwordHash = await hashPassword(body.password)
    const user = await createUser({ email: body.email, passwordHash })

    await setUserSession(event, { user: { id: user.id, email: user.email } })

    return { user: { id: user.id, email: user.email } }
  } catch (err) {
    throw toHttpError(err)
  }
})
