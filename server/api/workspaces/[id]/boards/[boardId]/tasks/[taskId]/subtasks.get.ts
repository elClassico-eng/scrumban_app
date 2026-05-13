import { z } from 'zod'
import { listSubTasks } from '../../../../../../../services/tasks.service'
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

    const tasks = await listSubTasks({
      workspaceId: id,
      parentTaskId: taskId,
      actorRole: workspace.role,
    })
    return { tasks }
  }
  catch (err) {
    throw toHttpError(err)
  }
})