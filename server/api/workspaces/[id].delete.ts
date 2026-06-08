import { z } from 'zod'
import { deleteWorkspace, getWorkspaceForUserOrThrow } from '../../services/workspaces.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    await deleteWorkspace({ workspaceId: id, actorRole: workspace.role })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
