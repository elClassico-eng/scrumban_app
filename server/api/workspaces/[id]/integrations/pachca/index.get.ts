import { z } from 'zod'
import { getPachcaState } from '../../../../../services/integrations.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return await getPachcaState({ workspaceId: id, userId: user.id, actorRole: ws.role })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
