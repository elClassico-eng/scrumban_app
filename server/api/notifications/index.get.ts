import { z } from 'zod'
import { listForUser } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const QuerySchema = z.object({
  unread: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const notifications = await listForUser({
      userId: user.id,
      unreadOnly: query.unread,
      limit: query.limit,
    })
    return { notifications }
  }
  catch (err) {
    throw toHttpError(err)
  }
})