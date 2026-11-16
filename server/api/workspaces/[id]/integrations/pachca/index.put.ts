import { z } from 'zod'
import { connectPachca } from '../../../../../services/integrations.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'
import { PachcaConnectSchema } from '#shared/validation/integrations'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, PachcaConnectSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    const integration = await connectPachca({ workspaceId: id, actorId: user.id, actorRole: ws.role, ...body })
    return { integration }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
