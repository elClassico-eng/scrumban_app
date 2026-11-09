import { listBackgrounds } from '../../../services/files.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    return { backgrounds: await listBackgrounds(user.id) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
