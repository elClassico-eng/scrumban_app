import { z } from 'zod'
import { unreadCountForUser } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { workspaceId } = await getValidatedQuery(event, z.object({ workspaceId: z.uuid().optional() }).parse)
    const count = await unreadCountForUser(user.id, workspaceId)
    return { count }
  }
  catch (err) {
    throw toHttpError(err)
  }
})