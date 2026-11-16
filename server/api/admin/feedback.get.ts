import { listFeedback } from '../../services/feedback.service'
import { requireAdmin } from '../../utils/admin'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    return { feedback: await listFeedback() }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
