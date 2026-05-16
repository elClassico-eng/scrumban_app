import { z } from 'zod'
import { computeBurndown } from '../../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

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

    const report = await computeBurndown({
      workspaceId: id,
      sprintId,
      actorRole: workspace.role,
    })
    return report
  }
  catch (err) {
    throw toHttpError(err)
  }
})
