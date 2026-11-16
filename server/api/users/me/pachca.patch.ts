import { updateAllMyLinks } from '../../../services/messenger-links.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'
import { PachcaMyLinkSchema } from '#shared/validation/integrations'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body = await readValidatedBody(event, PachcaMyLinkSchema.parse)
    return { links: await updateAllMyLinks({ userId: user.id, ...body }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
