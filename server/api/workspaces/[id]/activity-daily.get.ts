import { z } from 'zod'
import { activityDailyCounts } from '../../../services/activity.service'
import { getWorkspaceForUserOrThrow } from '../../../services/workspaces.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

const QuerySchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  tz: z.string().min(1).max(64).default('UTC'),
  board: z.uuid().optional(),
  actor: z.uuid().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const buckets = await activityDailyCounts({
      workspaceId: id,
      actorRole: workspace.role,
      from: new Date(query.from),
      to: new Date(query.to),
      timeZone: query.tz,
      boardId: query.board,
      actorId: query.actor,
    })

    return { buckets }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
