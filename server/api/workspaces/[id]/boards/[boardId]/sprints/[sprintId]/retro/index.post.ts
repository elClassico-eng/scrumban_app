import { z } from 'zod'
import { createRetroNote } from '../../../../../../../../services/sprint-retro.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), sprintId: z.uuid() })
const BodySchema = z.object({
  category: z.enum(['went_well', 'to_improve', 'action_item']),
  body: z.string().trim().min(1).max(2000),
  taskId: z.uuid().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const note = await createRetroNote({
      workspaceId: id,
      sprintId,
      category: body.category,
      body: body.body,
      taskId: body.taskId ?? null,
      actorId: user.id,
      actorRole: workspace.role,
    })
    setResponseStatus(event, 201)
    return { note }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
