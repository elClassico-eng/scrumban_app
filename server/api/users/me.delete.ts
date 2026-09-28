import { z } from 'zod'
import { deleteUser, findUserById } from '../../services/users.service'
import { deleteSession } from '../../services/user-sessions.service'
import { findSoleOwnedWorkspaces } from '../../services/workspaces.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError, UnauthorizedError, ValidationError } from '../../utils/errors'

const BodySchema = z.object({ password: z.string().min(1) })

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const body = await readValidatedBody(event, BodySchema.parse)

    const user = await findUserById(sessionUser.id)
    if (!user) throw new UnauthorizedError('Пользователь не найден')

    const ok = await verifyPassword(user.passwordHash, body.password)
    if (!ok) throw new UnauthorizedError('Пароль неверный')

    // Every FK to users.id is cascade or set-null, so the row can go as-is:
    // memberships and sessions disappear, authorship of comments and events
    // survives as null. The one thing the DB cannot decide is a workspace
    // left without an owner.
    const orphaned = await findSoleOwnedWorkspaces(user.id)
    if (orphaned.length > 0) {
      const names = orphaned.map(w => `«${w.name}»`).join(', ')
      throw new ValidationError(
        `Вы единственный владелец команд: ${names}. Назначьте другого владельца на странице участников или удалите команду, затем повторите.`,
      )
    }

    const session = await getUserSession(event)
    if (session.sessionId) await deleteSession(session.sessionId)
    await deleteUser(user.id)
    await clearUserSession(event)

    setResponseStatus(event, 204)
    return null
  }
  catch (err) {
    throw toHttpError(err)
  }
})
