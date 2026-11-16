import { z } from 'zod'
import { listWorkspaceFeeds } from '../../../../../services/board-feeds.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return { feeds: await listWorkspaceFeeds({ workspaceId: id, actorRole: ws.role }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
