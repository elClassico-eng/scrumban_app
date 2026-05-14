import { z } from 'zod'
import { updateComment } from '../../../../../../../../services/comments.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
  commentId: z.uuid(),
})
const BodySchema = z.object({
  body: z.string().min(1).max(5000),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, commentId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const comment = await updateComment({
      workspaceId: id,
      commentId,
      editorId: user.id,
      body: body.body,
      actorRole: workspace.role,
    })
    return { comment }
  }
  catch (err) {
    throw toHttpError(err)
  }
})