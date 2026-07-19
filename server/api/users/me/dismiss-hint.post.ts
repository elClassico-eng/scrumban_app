import { z } from 'zod'
import { dismissHint } from '../../../services/users.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const BodySchema = z.object({
  key: z.string().trim().min(1).max(64),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { key } = await readValidatedBody(event, BodySchema.parse)
    const dismissedHints = await dismissHint(user.id, key)
    return { dismissedHints }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
