import { z } from 'zod'
import { requestLink } from '../../../../../services/messenger-links.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'
import { PachcaLinkSchema } from '#shared/validation/integrations'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const { pachcaUserId } = await readValidatedBody(event, PachcaLinkSchema.parse)
    await getWorkspaceForUserOrThrow(id, user.id)
    await requestLink({ workspaceId: id, userId: user.id, pachcaUserId })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
