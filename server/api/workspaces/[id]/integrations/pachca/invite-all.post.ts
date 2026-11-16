import { z } from 'zod'
import { inviteAll } from '../../../../../services/messenger-links.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })
const BodySchema = z.object({ dryRun: z.boolean() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const { dryRun } = await readValidatedBody(event, BodySchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return await inviteAll({ workspaceId: id, actorRole: ws.role, dryRun })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
