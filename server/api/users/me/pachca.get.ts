import { listMyLinks } from '../../../services/messenger-links.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    return { links: await listMyLinks(user.id) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
