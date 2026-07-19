import { z } from 'zod'
import { updateScenario } from '../../../../../../../../services/sprint-scenarios.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'
import { ScenarioChangesSchema } from '../../../../../../../../utils/scenario-changes'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
  scenarioId: z.uuid(),
})

const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    changes: ScenarioChangesSchema.optional(),
  })
  .refine(d => d.name !== undefined || d.changes !== undefined, {
    message: 'Provide at least one field to update',
  })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, sprintId, scenarioId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const scenario = await updateScenario({
      workspaceId: id,
      boardId,
      sprintId,
      scenarioId,
      patch: { name: body.name, changes: body.changes },
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { scenario }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
