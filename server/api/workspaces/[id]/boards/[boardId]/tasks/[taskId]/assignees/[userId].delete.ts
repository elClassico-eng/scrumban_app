import { z } from 'zod'
import { removeAssignee } from '../../../../../../../../services/task-assignees.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
  userId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, taskId, userId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await removeAssignee({
      workspaceId: id,
      taskId,
      userId,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
