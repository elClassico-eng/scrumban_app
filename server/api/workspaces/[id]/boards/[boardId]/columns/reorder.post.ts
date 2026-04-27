// POST /api/workspaces/:id/boards/:boardId/columns/reorder — atomic bulk
// reorder. Body lists every column id in the desired order; service
// validates completeness and renumbers in two phases inside a single
// transaction.
import { z } from 'zod'
import { reorderColumns } from '../../../../../../services/columns.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const BodySchema = z.object({
  orderedIds: z.array(z.uuid()).min(1),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const columns = await reorderColumns({
      workspaceId: id,
      boardId,
      orderedIds: body.orderedIds,
      actorRole: workspace.role,
    })
    return { columns }
  } catch (err) {
    throw toHttpError(err)
  }
})
