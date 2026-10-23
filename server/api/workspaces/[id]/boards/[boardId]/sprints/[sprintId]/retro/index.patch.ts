import { z } from 'zod'
import { setRetroPhase } from '../../../../../../../../services/sprint-retro.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), sprintId: z.uuid() })
const BodySchema = z.object({ phase: z.enum(['collect', 'discuss']) })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const { phase } = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    await setRetroPhase({ workspaceId: id, sprintId, phase, actorRole: workspace.role })
    return { phase }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
