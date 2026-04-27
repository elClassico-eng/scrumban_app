// DELETE /api/workspaces/:id/boards/:boardId/sprints/:sprintId —
// admin+. Cascades to sprint_tasks; tasks themselves remain.
import { z } from 'zod'
import { deleteSprint } from '../../../../../../services/sprints.service'
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
    await deleteSprint({ workspaceId: id, sprintId, actorRole: workspace.role })
    setResponseStatus(event, 204)
    return null
  } catch (err) {
    throw toHttpError(err)
  }
})
