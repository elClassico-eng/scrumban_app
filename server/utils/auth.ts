// requireAuth: helper used by protected handlers. Returns the session.user
// (typed via shared/types/auth.d.ts) or throws 401. Keeps the auth boilerplate
// out of every handler.
import type { H3Event } from 'h3'
import { touchSession } from '../services/user-sessions.service'
import { UnauthorizedError } from './errors'

export async function requireAuth(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user) throw new UnauthorizedError('Требуется авторизация')

  // A cookie whose DB session row is gone was revoked from another device.
  // Cookies minted before session tracking carry no sessionId and pass through;
  // they pick one up on the next login.
  if (session.sessionId && !(await touchSession(session.sessionId))) {
    await clearUserSession(event)
    throw new UnauthorizedError('Сессия завершена')
  }
  return session.user
}
