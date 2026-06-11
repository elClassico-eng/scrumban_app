import { z } from 'zod'
import { stopTimer } from '../../../../../../../../services/time-tracking.service'
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
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const stopped = await stopTimer({
      workspaceId: id,
      boardId,
      userId: user.id,
      actorRole: workspace.role,
    })

    return { entry: stopped ? { ...stopped, running: false, elapsedSeconds: stopped.durationSeconds ?? 0 } : null }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
