import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { passwordSchema } from '#shared/validation/password'
import { users } from '../../../db/schema'
import { findUserById } from '../../../services/users.service'
import { requireAuth } from '../../../utils/auth'
import { useDB } from '../../../utils/db'
import { toHttpError, UnauthorizedError } from '../../../utils/errors'

const BodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const body = await readValidatedBody(event, BodySchema.parse)

    const user = await findUserById(sessionUser.id)
    if (!user) throw new UnauthorizedError('Пользователь не найден')

    const ok = await verifyPassword(user.passwordHash, body.currentPassword)
    if (!ok) throw new UnauthorizedError('Текущий пароль неверный')

    const passwordHash = await hashPassword(body.newPassword)
    await useDB()
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id))

    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
