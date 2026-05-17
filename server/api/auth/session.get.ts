// GET /api/auth/session — returns the current user or 401.
// Frontend uses this on app load to know whether to redirect to /login.
import { findUserById } from '../../services/users.service'
import { requireAuth } from '../../utils/auth'
import { NotFoundError, toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const user = await findUserById(sessionUser.id)
    if (!user) throw new NotFoundError('Пользователь не найден')

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        bio: user.bio,
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      },
    }
  } catch (err) {
    throw toHttpError(err)
  }
})
