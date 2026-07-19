import { z } from 'zod'
import { generateSprintReport } from '../../../../../../../../services/sprint-reports.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const row = await generateSprintReport({
      workspaceId: id,
      sprintId,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return {
      report: {
        sprintId: row.sprintId,
        payload: row.payload,
        generatedAt: row.generatedAt.toISOString(),
        generatedBy: row.generatedBy,
      },
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
