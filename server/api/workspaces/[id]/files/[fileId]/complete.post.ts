import { z } from 'zod'
import { completeUpload } from '../../../../../services/files.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), fileId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, fileId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    await getWorkspaceForUserOrThrow(id, user.id)
    return { file: await completeUpload({ workspaceId: id, userId: user.id, fileId }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
