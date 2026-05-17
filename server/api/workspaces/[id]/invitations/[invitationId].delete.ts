import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { cancelInvitation } from '../../../../services/workspace-invitations.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  invitationId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, invitationId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await cancelInvitation({
      workspaceId: id,
      invitationId,
      actorRole: workspace.role,
    })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})