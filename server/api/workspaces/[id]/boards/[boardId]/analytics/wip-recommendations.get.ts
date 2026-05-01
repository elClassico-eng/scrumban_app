// GET /api/workspaces/:id/boards/:boardId/analytics/wip-recommendations
// — Little's Law (L = λ × W) recommendation per WIP-relevant column.
// Returns ok=false with reason='insufficient_data' when fewer than 5
// closed tasks exist in the last 30 days.
import { z } from 'zod'
import { computeWipRecommendations } from '../../../../../../services/analytics.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const report = await computeWipRecommendations({
      workspaceId: id,
      boardId,
      actorRole: workspace.role,
    })
    return report
  } catch (err) {
    throw toHttpError(err)
  }
})
