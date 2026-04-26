// GET /api/workspaces/:id — return one workspace if the current user is a
// member; 404 otherwise (we deliberately do not distinguish "not found"
// from "forbidden" — this prevents leaking workspace existence).
import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../services/workspaces.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    return { workspace }
  } catch (err) {
    throw toHttpError(err)
  }
})
