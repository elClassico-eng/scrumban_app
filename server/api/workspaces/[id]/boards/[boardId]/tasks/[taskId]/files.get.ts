import { z } from 'zod'
import { listTaskFiles } from '../../../../../../../services/files.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), taskId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return { files: await listTaskFiles({ workspaceId: id, taskId, userId: user.id, actorRole: ws.role }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
