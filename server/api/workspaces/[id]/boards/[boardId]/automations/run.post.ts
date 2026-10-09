import { z } from 'zod'
import { runBoard } from '../../../../../../services/automations.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'
import { requireMinRole } from '../../../../../../utils/rbac'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    requireMinRole(workspace.role, 'scrum_master')
    return await runBoard(id, boardId)
  } catch (err) {
    throw toHttpError(err)
  }
})
