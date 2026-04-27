// GET /api/workspaces/:id/boards/:boardId/sprints/:sprintId — single sprint.
import { z } from 'zod'
import { getSprint, listSprintTasks } from '../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const sprint = await getSprint({
      workspaceId: id,
      sprintId,
      actorRole: workspace.role,
    })
    const taskRefs = await listSprintTasks({
      workspaceId: id,
      sprintId,
      actorRole: workspace.role,
    })
    return { sprint, taskIds: taskRefs.map((t) => t.taskId) }
  } catch (err) {
    throw toHttpError(err)
  }
})
