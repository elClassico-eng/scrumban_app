import { z } from 'zod'
import { dropLinks } from '../../../../../services/messenger-links.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    await getWorkspaceForUserOrThrow(id, user.id)
    await dropLinks(id, user.id)
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
