// POST /sprints/:sprintId/tasks — attach a task to the sprint (member+).
// Task must belong to the same board as the sprint; sprint must not be
// closed.
import { z } from 'zod'
import { addTaskToSprint } from '../../../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
})
const BodySchema = z.object({ taskId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    await addTaskToSprint({
      workspaceId: id,
      sprintId,
      taskId: body.taskId,
      actorRole: workspace.role,
    })
    setResponseStatus(event, 201)
    return { ok: true }
  } catch (err) {
    throw toHttpError(err)
  }
})
