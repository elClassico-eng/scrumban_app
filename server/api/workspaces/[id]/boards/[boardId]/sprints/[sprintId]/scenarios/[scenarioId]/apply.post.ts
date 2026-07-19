import { z } from 'zod'
import { applyScenario } from '../../../../../../../../../services/sprint-scenarios.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
  scenarioId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, sprintId, scenarioId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const scenario = await applyScenario({
      workspaceId: id,
      boardId,
      sprintId,
      scenarioId,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { scenario }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
