import { z } from 'zod'
import { listOpenAssignedComments } from '../../../services/comments.service'
import { getWorkspaceForUserOrThrow } from '../../../services/workspaces.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const comments = await listOpenAssignedComments({
      workspaceId: id,
      userId: user.id,
      actorRole: workspace.role,
    })
    return { comments }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
