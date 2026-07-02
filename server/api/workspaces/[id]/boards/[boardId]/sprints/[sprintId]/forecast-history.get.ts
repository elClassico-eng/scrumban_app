import { z } from 'zod'
import { listSprintSnapshots } from '../../../../../../../services/forecast-snapshots.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), sprintId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const snapshots = await listSprintSnapshots({
      workspaceId: id,
      sprintId,
      actorRole: workspace.role,
    })
    return { snapshots }
  } catch (err) {
    throw toHttpError(err)
  }
})
