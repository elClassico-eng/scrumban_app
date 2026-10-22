import { z } from 'zod'
import { updateCommentAssignment } from '../../../../../../../../../services/comments.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
  commentId: z.uuid(),
})
const BodySchema = z
  .object({
    assigneeId: z.uuid().nullable().optional(),
    resolved: z.boolean().optional(),
  })
  .refine(d => d.assigneeId !== undefined || d.resolved !== undefined, {
    message: 'Укажите assigneeId или resolved',
  })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, commentId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const comment = await updateCommentAssignment({
      workspaceId: id,
      commentId,
      actorId: user.id,
      actorRole: workspace.role,
      assigneeId: body.assigneeId,
      resolved: body.resolved,
    })
    return { comment }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
