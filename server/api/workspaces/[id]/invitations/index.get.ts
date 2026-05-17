import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { listActiveInvitations } from '../../../../services/workspace-invitations.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const invitations = await listActiveInvitations({
      workspaceId: id,
      actorRole: workspace.role,
    })
    return { invitations }
  }
  catch (err) {
    throw toHttpError(err)
  }
})