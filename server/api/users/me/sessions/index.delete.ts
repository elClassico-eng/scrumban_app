import { revokeOtherSessions } from '../../../../services/user-sessions.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError, UnauthorizedError } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const session = await getUserSession(event)
    // Cookies issued before session rows existed carry no id, so we cannot
    // tell which row to keep — refuse rather than revoke the caller's own.
    if (!session.sessionId) throw new UnauthorizedError('Войдите заново, чтобы управлять сессиями')
    const revoked = await revokeOtherSessions(user.id, session.sessionId)
    return { revoked }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
