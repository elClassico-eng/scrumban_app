import { z } from 'zod'
import { inspectLink } from '../../../../services/messenger-links.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { token } = await getValidatedRouterParams(event, ParamsSchema.parse)
    return await inspectLink(token, user.id)
  }
  catch (err) {
    throw toHttpError(err)
  }
})
