import { z } from 'zod'
import { startTimer, getActiveTimer } from '../../../../../../../../services/time-tracking.service'
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
    const { id, boardId, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await startTimer({
      workspaceId: id,
      boardId,
      taskId,
      userId: user.id,
      actorRole: workspace.role,
    })

    const active = await getActiveTimer({
      workspaceId: id,
      userId: user.id,
      actorRole: workspace.role,
    })

    return { active }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
