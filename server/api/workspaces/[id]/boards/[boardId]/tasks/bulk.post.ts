import { z } from 'zod'
import { bulkUpdateTasks, type BulkAction } from '../../../../../../services/tasks-bulk.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), columnId: z.uuid(), force: z.boolean().optional(), forceReason: z.string().trim().max(500).optional() }),
  z.object({ type: z.literal('service_class'), value: z.enum(['expedite', 'fixed_date', 'standard', 'intangible']) }),
  z.object({ type: z.literal('assignee'), userId: z.uuid().nullable() }),
  z.object({ type: z.literal('due'), dueDate: z.iso.datetime().nullable() }),
  z.object({ type: z.literal('parent'), parentTaskId: z.uuid().nullable() }),
  z.object({ type: z.literal('sprint_add'), sprintId: z.uuid() }),
  z.object({ type: z.literal('sprint_remove'), sprintId: z.uuid() }),
  z.object({ type: z.literal('delete') }),
])

const BodySchema = z.object({
  taskIds: z.array(z.uuid()).min(1).max(200).refine(a => new Set(a).size === a.length, { message: 'Задачи не должны повторяться' }),
  action: ActionSchema,
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const action: BulkAction = body.action.type === 'due'
      ? { type: 'due', dueDate: body.action.dueDate === null ? null : new Date(body.action.dueDate) }
      : body.action
    const results = await bulkUpdateTasks({
      workspaceId: id,
      boardId,
      taskIds: body.taskIds,
      action,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { results }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
