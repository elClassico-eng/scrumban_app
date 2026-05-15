import { z } from 'zod'
import { listAssignees } from '../../../../../../../../services/task-assignees.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

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

    const assignees = await listAssignees({
      workspaceId: id,
      taskId,
      actorRole: workspace.role,
    })
    return { assignees }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
