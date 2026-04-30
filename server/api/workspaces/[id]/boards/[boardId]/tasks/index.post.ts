// POST /api/workspaces/:id/boards/:boardId/tasks — create a task in a
// specified column (member+). Position is auto-appended within the column.
import { z } from 'zod'
import { createTask } from '../../../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const BodySchema = z.object({
  columnId: z.uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20_000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assigneeId: z.uuid().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const task = await createTask({
      workspaceId: id,
      boardId,
      ...body,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { task }
  } catch (err) {
    throw toHttpError(err)
  }
})
