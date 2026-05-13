import { z } from 'zod'
import { reorderChecklist } from '../../../../../../../../services/task-checklist.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
})
const BodySchema = z.object({
  orderedIds: z.array(z.uuid()).min(1),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const items = await reorderChecklist({
      workspaceId: id,
      taskId,
      orderedIds: body.orderedIds,
      actorRole: workspace.role,
    })
    return { items }
  }
  catch (err) {
    throw toHttpError(err)
  }
})