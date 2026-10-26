import { z } from 'zod'
import { updateFeed } from '../../../../../../services/board-feeds.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'
import { UpdateFeedSchema } from '#shared/validation/integrations'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), feedId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, feedId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, UpdateFeedSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return { feed: await updateFeed({ workspaceId: id, boardId, feedId, actorRole: ws.role, ...body }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
