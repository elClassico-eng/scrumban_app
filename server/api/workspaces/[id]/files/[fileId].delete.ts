import { z } from 'zod'
import { deleteFile } from '../../../../services/files.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), fileId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, fileId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    await deleteFile({ workspaceId: id, userId: user.id, actorRole: ws.role, fileId })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
