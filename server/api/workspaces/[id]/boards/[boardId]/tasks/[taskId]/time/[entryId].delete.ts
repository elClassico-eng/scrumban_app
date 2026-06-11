import { z } from 'zod'
import { deleteEntry } from '../../../../../../../../services/time-tracking.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
  entryId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, entryId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await deleteEntry({
      workspaceId: id,
      boardId,
      entryId,
      actorId: user.id,
      actorRole: workspace.role,
    })

    return {}
  }
  catch (err) {
    throw toHttpError(err)
  }
})
