import type { H3Event } from 'h3'
import { requireAuth } from './auth'
import { ForbiddenError } from './errors'

export async function requireAdmin(event: H3Event) {
  const user = await requireAuth(event)
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  if (!allowed.includes(user.email.toLowerCase())) {
    throw new ForbiddenError('Доступ только для администратора')
  }
  return user
}
