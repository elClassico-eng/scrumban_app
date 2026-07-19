import { z } from 'zod'
import { removeRetroNote } from '../../../../../../../../services/sprint-retro.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), sprintId: z.uuid(), noteId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId, noteId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    await removeRetroNote({
      workspaceId: id,
      sprintId,
      noteId,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
