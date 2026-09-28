import { z } from 'zod'
import { revokeSession } from '../../../../services/user-sessions.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ sessionId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { sessionId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    await revokeSession(user.id, sessionId)
    setResponseStatus(event, 204)
    return null
  }
  catch (err) {
    throw toHttpError(err)
  }
})
