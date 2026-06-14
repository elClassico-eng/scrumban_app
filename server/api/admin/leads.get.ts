import { listLeads } from '../../services/leads.service'
import { requireAdmin } from '../../utils/admin'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    const leads = await listLeads()
    return { leads }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
