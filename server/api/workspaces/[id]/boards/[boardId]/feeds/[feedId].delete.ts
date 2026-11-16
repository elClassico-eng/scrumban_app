import { z } from 'zod'
import { deleteFeed } from '../../../../../../services/board-feeds.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), feedId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, feedId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    await deleteFeed({ workspaceId: id, boardId, feedId, actorRole: ws.role })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
