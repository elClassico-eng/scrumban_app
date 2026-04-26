// GET /api/auth/session — returns the current user or 401.
// Frontend uses this on app load to know whether to redirect to /login.
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    return { user }
  } catch (err) {
    throw toHttpError(err)
  }
})
