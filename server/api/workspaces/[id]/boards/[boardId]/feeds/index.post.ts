import { z } from 'zod'
import { createFeed } from '../../../../../../services/board-feeds.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'
import { CreateFeedSchema } from '#shared/validation/integrations'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, CreateFeedSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return { feed: await createFeed({ workspaceId: id, boardId, actorId: user.id, actorRole: ws.role, ...body }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
