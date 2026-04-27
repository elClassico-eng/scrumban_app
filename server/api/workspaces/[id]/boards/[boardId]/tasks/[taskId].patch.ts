// PATCH /api/workspaces/:id/boards/:boardId/tasks/:taskId — change
// title / description / priority / assignee. Moving the task between
// columns goes through the dedicated /move endpoint (Step 12) so we can
// run state-machine logic and write task_events.
import { z } from 'zod'
import { updateTaskFields } from '../../../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
})
const BodySchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(20_000).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    assigneeId: z.uuid().nullable().optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.description !== undefined ||
      d.priority !== undefined ||
      d.assigneeId !== undefined,
    { message: 'Provide at least one field to update' },
  )

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const task = await updateTaskFields({
      workspaceId: id,
      taskId,
      patch: body,
      actorRole: workspace.role,
    })
    return { task }
  } catch (err) {
    throw toHttpError(err)
  }
})
