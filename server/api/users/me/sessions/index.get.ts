import { listSessions } from '../../../../services/user-sessions.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const session = await getUserSession(event)
    const rows = await listSessions(user.id)
    return {
      sessions: rows.map(s => ({
        id: s.id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        current: s.id === session.sessionId,
      })),
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
