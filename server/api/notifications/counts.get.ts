import { z } from 'zod'
import { inboxCounts } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const QuerySchema = z.object({ workspaceId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { workspaceId } = await getValidatedQuery(event, QuerySchema.parse)
    return await inboxCounts(user.id, workspaceId)
  }
  catch (err) {
    throw toHttpError(err)
  }
})
