import { z } from 'zod'
import { storageUsage } from '../../../../services/files.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    await getWorkspaceForUserOrThrow(id, user.id)
    return await storageUsage(id)
  }
  catch (err) {
    throw toHttpError(err)
  }
})
