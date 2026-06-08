import { z } from 'zod'
import { getWorkspaceForUserOrThrow, setWorkspaceLabel } from '../../../services/workspaces.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })
const BodySchema = z.object({ label: z.string().trim().max(40).nullable() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    await getWorkspaceForUserOrThrow(id, user.id)
    const result = await setWorkspaceLabel({ workspaceId: id, userId: user.id, label: body.label })
    return result
  }
  catch (err) {
    throw toHttpError(err)
  }
})
