import { removeAvatar } from '../../../../services/files.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    await removeAvatar(user.id)
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
