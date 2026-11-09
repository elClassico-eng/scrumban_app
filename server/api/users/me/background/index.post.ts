import { startUserImageUpload } from '../../../../services/files.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'
import { StartAvatarUploadSchema } from '#shared/validation/files'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body = await readValidatedBody(event, StartAvatarUploadSchema.parse)
    return await startUserImageUpload({ userId: user.id, kind: 'user_background', body })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
