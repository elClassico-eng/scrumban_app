import { z } from 'zod'
import { markAllRead } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const BodySchema = z.object({
  workspaceId: z.uuid().optional(),
}).optional()

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body = await readValidatedBody(event, BodySchema.parse).catch(() => undefined)
    const count = await markAllRead({ userId: user.id, workspaceId: body?.workspaceId })
    return { count }
  }
  catch (err) {
    throw toHttpError(err)
  }
})