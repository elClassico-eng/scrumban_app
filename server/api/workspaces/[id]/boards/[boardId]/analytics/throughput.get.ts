// GET /api/workspaces/:id/boards/:boardId/analytics/throughput — count
// of task_closed events bucketed by day or week. Defaults to the last
// 30 days (day) or 12 weeks (week).
import { z } from 'zod'
import { computeThroughput } from '../../../../../../services/analytics.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const QuerySchema = z.object({
  period: z.enum(['day', 'week']).optional().default('day'),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
})

const DAY_MS = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const now = new Date()
    const defaultSpanDays = query.period === 'week' ? 12 * 7 : 30
    const to = query.to ? new Date(query.to) : now
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - defaultSpanDays * DAY_MS)

    const buckets = await computeThroughput({
      workspaceId: id,
      boardId,
      period: query.period,
      from,
      to,
      actorRole: workspace.role,
    })
    return { period: query.period, from: from.toISOString(), to: to.toISOString(), buckets }
  } catch (err) {
    throw toHttpError(err)
  }
})
