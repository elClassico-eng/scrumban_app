import { z } from 'zod'
import { updateMyLink } from '../../../../../services/messenger-links.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'
import { PachcaMyLinkSchema } from '#shared/validation/integrations'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, PachcaMyLinkSchema.parse)
    await getWorkspaceForUserOrThrow(id, user.id)
    return { me: await updateMyLink({ workspaceId: id, userId: user.id, ...body }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
