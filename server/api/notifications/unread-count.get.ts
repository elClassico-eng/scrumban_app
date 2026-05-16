import { unreadCountForUser } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const count = await unreadCountForUser(user.id)
    return { count }
  }
  catch (err) {
    throw toHttpError(err)
  }
})