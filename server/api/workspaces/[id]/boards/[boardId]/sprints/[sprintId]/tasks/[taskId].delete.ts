// DELETE /sprints/:sprintId/tasks/:taskId — detach a task from the
// sprint (member+). Sprint must not be closed.
import { z } from 'zod'
import { removeTaskFromSprint } from '../../../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
  taskId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    await removeTaskFromSprint({
      workspaceId: id,
      sprintId,
      taskId,
      actorRole: workspace.role,
    })
    setResponseStatus(event, 204)
    return null
  } catch (err) {
    throw toHttpError(err)
  }
})
