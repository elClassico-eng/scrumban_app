import { z } from 'zod'
import { findCandidates } from '../../../../../services/messenger-links.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })
const QuerySchema = z.object({ query: z.string().max(100).default('') })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const { query } = await getValidatedQuery(event, QuerySchema.parse)
    await getWorkspaceForUserOrThrow(id, user.id)
    return { candidates: await findCandidates({ workspaceId: id, userId: user.id, query }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
