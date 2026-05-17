import { z } from 'zod'
import { inspectInvitationByToken } from '../../services/workspace-invitations.service'
import { toHttpError } from '../../utils/errors'

const ParamsSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
})

export default defineEventHandler(async (event) => {
  try {
    const { token } = await getValidatedRouterParams(event, ParamsSchema.parse)
    return await inspectInvitationByToken(token)
  }
  catch (err) {
    throw toHttpError(err)
  }
})