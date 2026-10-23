import { z } from 'zod'
import { setWatching } from '../../../../../../../../services/task-watchers.service'
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
    await setWatching({ workspaceId: id, taskId, userId: user.id, watching: false, actorRole: workspace.role })
    return { watching: false }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
