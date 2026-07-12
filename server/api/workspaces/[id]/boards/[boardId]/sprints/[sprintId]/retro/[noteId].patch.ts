import { z } from 'zod'
import { updateRetroNote } from '../../../../../../../../services/sprint-retro.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), sprintId: z.uuid(), noteId: z.uuid() })
const BodySchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    category: z.enum(['went_well', 'to_improve', 'action_item']).optional(),
    isResolved: z.boolean().optional(),
  })
  .refine(d => d.body !== undefined || d.category !== undefined || d.isResolved !== undefined, {
    message: 'Provide at least one field to update',
  })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId, noteId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const note = await updateRetroNote({
      workspaceId: id,
      sprintId,
      noteId,
      patch: body,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { note }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
