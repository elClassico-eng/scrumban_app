import { startAvatarUpload } from '../../../../services/files.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'
import { StartAvatarUploadSchema } from '#shared/validation/files'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body = await readValidatedBody(event, StartAvatarUploadSchema.parse)
    return await startAvatarUpload({ userId: user.id, body })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
