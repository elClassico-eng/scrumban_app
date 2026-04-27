// DELETE /api/workspaces/:id/boards/:boardId/columns/:columnId — remove
// an empty column (admin+). The FK from tasks.column_id is RESTRICT, so
// non-empty columns can't be dropped — service translates the FK error
// into a 422 ValidationError with a clear message.
import { z } from 'zod'
import { deleteColumn } from '../../../../../../services/columns.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  columnId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, columnId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await deleteColumn({ workspaceId: id, columnId, actorRole: workspace.role })
    setResponseStatus(event, 204)
    return null
  } catch (err) {
    throw toHttpError(err)
  }
})
