// GET /api/workspaces/:id/boards/:boardId/tasks/:taskId/events — full
// task_events log for this task, oldest first. Useful for the UI's
// "history" panel and as an inspection surface for analytics work.
import { z } from 'zod'
import { listTaskEvents } from '../../../../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

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
    const events = await listTaskEvents({
      workspaceId: id,
      taskId,
      actorRole: workspace.role,
    })
    return { events }
  } catch (err) {
    throw toHttpError(err)
  }
})
