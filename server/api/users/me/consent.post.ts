import { recordPersonalDataConsent } from '../../../services/users.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    await recordPersonalDataConsent(user.id)
    setResponseStatus(event, 204)
    return null
  }
  catch (err) {
    throw toHttpError(err)
  }
})
