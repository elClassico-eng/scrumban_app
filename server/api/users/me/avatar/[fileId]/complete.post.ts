import { z } from 'zod'
import { completeUpload } from '../../../../../services/files.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ fileId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { fileId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    return { file: await completeUpload({ workspaceId: null, userId: user.id, fileId }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
