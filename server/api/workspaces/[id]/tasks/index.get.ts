import { z } from 'zod'
import { listTasksForWorkspace } from '../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })
const QuerySchema = z.object({ assignee: z.literal('me').optional() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const tasks = await listTasksForWorkspace({
      workspaceId: id,
      actorRole: workspace.role,
      assigneeId: query.assignee === 'me' ? user.id : undefined,
    })
    return { tasks }
  } catch (err) {
    throw toHttpError(err)
  }
})
