// DELETE /api/workspaces/:id/boards/:boardId/tasks/:taskId — admin+.
// Cascades to task_events via FK ON DELETE CASCADE.
import { z } from 'zod'
import { deleteTask } from '../../../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await deleteTask({ workspaceId: id, taskId, actorRole: workspace.role })
    setResponseStatus(event, 204)
    return null
  } catch (err) {
    throw toHttpError(err)
  }
})
