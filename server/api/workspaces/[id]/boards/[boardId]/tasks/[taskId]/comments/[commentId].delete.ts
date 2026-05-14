import { z } from 'zod'
import { removeComment } from '../../../../../../../../services/comments.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
  commentId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, commentId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await removeComment({
      workspaceId: id,
      commentId,
      deleterId: user.id,
      actorRole: workspace.role,
    })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
