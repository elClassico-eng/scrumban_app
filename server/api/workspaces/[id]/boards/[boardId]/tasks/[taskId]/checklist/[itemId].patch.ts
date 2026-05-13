import { z } from 'zod'
import { updateChecklistItem } from '../../../../../../../../services/task-checklist.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
  itemId: z.uuid(),
})
const BodySchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    isDone: z.boolean().optional(),
  })
  .refine(d => d.title !== undefined || d.isDone !== undefined, {
    message: 'Provide at least one field to update',
  })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, itemId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const item = await updateChecklistItem({
      workspaceId: id,
      itemId,
      patch: body,
      actorRole: workspace.role,
    })
    return { item }
  }
  catch (err) {
    throw toHttpError(err)
  }
})