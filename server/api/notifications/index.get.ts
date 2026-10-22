import { z } from 'zod'
import { notificationType } from '../../db/schema'
import { listForUser } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const QuerySchema = z.object({
  unread: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  workspaceId: z.uuid().optional(),
  types: z.string().optional().transform(v => (v ? v.split(',') : undefined)).pipe(z.array(z.enum(notificationType.enumValues)).optional()),
  before: z.coerce.date().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const notifications = await listForUser({
      userId: user.id,
      workspaceId: query.workspaceId,
      types: query.types,
      unreadOnly: query.unread,
      before: query.before,
      limit: query.limit,
    })
    return { notifications }
  }
  catch (err) {
    throw toHttpError(err)
  }
})