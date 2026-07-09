import { z } from 'zod'
import { simulateScenario } from '../../../../../../../../services/sprint-scenarios.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'
import { ScenarioChangesSchema } from '../../../../../../../../utils/scenario-changes'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
})

const BodySchema = z.object({ changes: ScenarioChangesSchema })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const { changes } = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    return await simulateScenario({
      workspaceId: id,
      boardId,
      sprintId,
      changes,
      actorRole: workspace.role,
    })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
