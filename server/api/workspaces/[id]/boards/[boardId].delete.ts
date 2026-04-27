// DELETE /api/workspaces/:id/boards/:boardId — owner only.
// Cascades to board_columns, tasks and task_events via FK ON DELETE CASCADE.
import { z } from 'zod'
import { deleteBoard } from '../../../../services/boards.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await deleteBoard({ workspaceId: id, boardId, actorRole: workspace.role })
    setResponseStatus(event, 204)
    return null
  } catch (err) {
    throw toHttpError(err)
  }
})
