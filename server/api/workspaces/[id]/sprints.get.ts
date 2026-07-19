import { z } from 'zod'
import { listWorkspaceSprints } from '../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../services/workspaces.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const sprints = await listWorkspaceSprints({
      workspaceId: id,
      actorRole: workspace.role,
    })
    return { sprints }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
