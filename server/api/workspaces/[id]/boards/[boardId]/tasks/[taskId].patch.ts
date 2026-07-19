// PATCH /api/workspaces/:id/boards/:boardId/tasks/:taskId — change
// title / description / service_class / due_date / assignee. Moving the
// task between columns goes through the dedicated /move endpoint
// (Step 12) so we can run state-machine logic and write task_events.
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
    serviceClass: z.enum(['expedite', 'fixed_date', 'standard', 'intangible']).optional(),
    dueDate: z.iso.datetime().nullable().optional(),
    assigneeId: z.uuid().nullable().optional(),
    parentTaskId: z.uuid().nullable().optional(),
    blockedReason: z.string().max(500).nullable().optional(),
    isEpic: z.boolean().optional(),
    storyPoints: z.number().int().min(0).max(1000).nullable().optional(),
    estimateDays: z.number().positive().max(365).nullable().optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.description !== undefined ||
      d.serviceClass !== undefined ||
      d.dueDate !== undefined ||
      d.assigneeId !== undefined ||
      d.parentTaskId !== undefined ||
      d.blockedReason !== undefined ||
      d.isEpic !== undefined ||
      d.storyPoints !== undefined ||
      d.estimateDays !== undefined,
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
      patch: {
        title: body.title,
        description: body.description,
        serviceClass: body.serviceClass,
        ...(body.dueDate !== undefined
          ? { dueDate: body.dueDate === null ? null : new Date(body.dueDate) }
          : {}),
        ...('assigneeId' in body ? { assigneeId: body.assigneeId } : {}),
        ...('parentTaskId' in body ? { parentTaskId: body.parentTaskId } : {}),
        ...('blockedReason' in body ? { blockedReason: body.blockedReason } : {}),
        ...(body.isEpic !== undefined ? { isEpic: body.isEpic } : {}),
        ...('storyPoints' in body ? { storyPoints: body.storyPoints } : {}),
        ...('estimateDays' in body ? { estimateDays: body.estimateDays } : {}),
      },
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { task }
  } catch (err) {
    throw toHttpError(err)
  }
})
