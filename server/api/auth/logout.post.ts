// POST /api/auth/logout — clears the signed session cookie.
// Idempotent: returns ok=true even if there was no active session.
import { deleteSession } from '../../services/user-sessions.service'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (session.sessionId) await deleteSession(session.sessionId)
  await clearUserSession(event)
  return { ok: true }
})
