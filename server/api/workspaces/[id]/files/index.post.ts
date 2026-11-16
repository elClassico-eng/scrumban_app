import { z } from 'zod'
import { startUpload } from '../../../../services/files.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'
import { StartUploadSchema } from '#shared/validation/files'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, StartUploadSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return await startUpload({ workspaceId: id, userId: user.id, actorRole: ws.role, body })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
