// GET /api/workspaces/:id/boards/:boardId/tasks — flat list of tasks
// on this board, ordered by (columnId, position). Frontend groups them
// by column for the kanban view.
import { z } from 'zod'
import { listTasksForBoard } from '../../../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const tasks = await listTasksForBoard({
      workspaceId: id,
      boardId,
      actorRole: workspace.role,
    })
    return { tasks }
  } catch (err) {
    throw toHttpError(err)
  }
})
