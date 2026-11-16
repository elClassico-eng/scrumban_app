import { deletionPreview } from '../../../services/users.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    return await deletionPreview(user.id)
  }
  catch (err) {
    throw toHttpError(err)
  }
})
