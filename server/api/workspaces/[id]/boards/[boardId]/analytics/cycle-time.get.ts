// GET /api/workspaces/:id/boards/:boardId/analytics/cycle-time — per-task
// cycle time (hours from task_created to task_closed) plus aggregate
// stats. Percentiles return null when fewer than 5 samples are in window
// — small-sample noise should not be presented as a finding.
import { z } from 'zod'
import { computeCycleTime } from '../../../../../../services/analytics.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const QuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
})

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_SPAN_DAYS = 90

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const now = new Date()
    const to = query.to ? new Date(query.to) : now
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_SPAN_DAYS * DAY_MS)

    const report = await computeCycleTime({
      workspaceId: id,
      boardId,
      from,
      to,
      actorRole: workspace.role,
    })
    return { from: from.toISOString(), to: to.toISOString(), ...report }
  } catch (err) {
    throw toHttpError(err)
  }
})
