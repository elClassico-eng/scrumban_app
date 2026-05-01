// GET /api/workspaces/:id/boards/:boardId/analytics/monte-carlo
// — empirical bootstrap forecast: probability of finishing N tasks
// within H days, given the team's recent daily throughput.
//
// Returns ok=false with reason='insufficient_data' when fewer than
// 14 days of history is available — small samples of throughput are
// statistical noise and shouldn't drive product decisions.
import { z } from 'zod'
import { computeMonteCarlo } from '../../../../../../services/analytics.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const QuerySchema = z.object({
  tasksRemaining: z.coerce.number().int().min(0).max(1000),
  horizonDays: z.coerce.number().int().min(1).max(180),
  iterations: z.coerce.number().int().min(100).max(10_000).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const report = await computeMonteCarlo({
      workspaceId: id,
      boardId,
      tasksRemaining: query.tasksRemaining,
      horizonDays: query.horizonDays,
      iterations: query.iterations,
      actorRole: workspace.role,
    })
    return report
  } catch (err) {
    throw toHttpError(err)
  }
})
