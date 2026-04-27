// GET /api/workspaces/:id/boards — list boards in the workspace.
// Visible to any workspace member (viewer+).
import { z } from 'zod'
import { listBoards } from '../../../../services/boards.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const boards = await listBoards(id, workspace.role)
    return { boards }
  } catch (err) {
    throw toHttpError(err)
  }
})
