import { z } from 'zod'
import { computeAndStoreSLE } from '../../../../../../services/boards.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const result = await computeAndStoreSLE({
      workspaceId: id,
      boardId,
      actorRole: workspace.role,
    })
    return result
  }
  catch (err) {
    throw toHttpError(err)
  }
})