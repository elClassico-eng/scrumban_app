import { z } from 'zod'
import { removeScenario } from '../../../../../../../../services/sprint-scenarios.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
  scenarioId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId, scenarioId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    await removeScenario({
      workspaceId: id,
      sprintId,
      scenarioId,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
