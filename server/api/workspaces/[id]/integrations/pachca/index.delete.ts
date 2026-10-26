import { z } from 'zod'
import { disconnectPachca } from '../../../../../services/integrations.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    await disconnectPachca({ workspaceId: id, actorRole: ws.role })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
