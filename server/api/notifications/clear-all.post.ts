import { z } from 'zod'
import { clearAll } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const BodySchema = z.object({
  workspaceId: z.uuid(),
  view: z.enum(['primary', 'flow']),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body = await readValidatedBody(event, BodySchema.parse)
    const count = await clearAll({ userId: user.id, ...body })
    return { count }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
