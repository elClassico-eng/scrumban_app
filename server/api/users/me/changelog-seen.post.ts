import { markChangelogSeen } from '../../../services/users.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const changelogSeenAt = await markChangelogSeen(user.id)
    return { changelogSeenAt }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
