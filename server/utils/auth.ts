// requireAuth: helper used by protected handlers. Returns the session.user
// (typed via shared/types/auth.d.ts) or throws 401. Keeps the auth boilerplate
// out of every handler.
import type { H3Event } from 'h3'
import { UnauthorizedError } from './errors'

export async function requireAuth(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user) throw new UnauthorizedError('Требуется авторизация')
  return session.user
}
