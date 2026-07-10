import { findUserById } from '../../services/users.service'
import { requireAuth } from '../../utils/auth'
import { NotFoundError, toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const user = await findUserById(sessionUser.id)
    if (!user) throw new NotFoundError('Пользователь не найден')

    // passwordHash is never exposed to the client.
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
        dismissedHints: user.dismissedHints ?? [],
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
