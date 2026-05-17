import { findUserById } from '../../services/users.service'
import { listPendingInvitationsForEmail } from '../../services/workspace-invitations.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const user = await findUserById(sessionUser.id)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

    const invitations = await listPendingInvitationsForEmail(user.email)
    return { invitations }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
