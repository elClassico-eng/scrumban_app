import { z } from 'zod'
import { createComment } from '../../../../../../../../services/comments.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
})
const BodySchema = z.object({
  body: z.string().max(5000).default(''),
  parentId: z.uuid().optional(),
  fileIds: z.array(z.uuid()).max(10).default([]),
}).refine(b => b.body.trim().length > 0 || b.fileIds.length > 0, { message: 'Комментарий не может быть пустым' })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const comment = await createComment({
      workspaceId: id,
      taskId,
      authorId: user.id,
      body: body.body,
      parentId: body.parentId,
      fileIds: body.fileIds,
      actorRole: workspace.role,
    })
    return { comment }
  }
  catch (err) {
    throw toHttpError(err)
  }
})