import { z } from 'zod'
import { markRead } from '../../../services/notifications.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const notification = await markRead({ userId: user.id, notificationId: id })
    return { notification }
  }
  catch (err) {
    throw toHttpError(err)
  }
})