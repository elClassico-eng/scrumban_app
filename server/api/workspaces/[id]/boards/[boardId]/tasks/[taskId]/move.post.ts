// POST /api/workspaces/:id/boards/:boardId/tasks/:taskId/move — change
// a task's column and/or position (member+). Triggers the state machine:
// entering a `done` column sets closed_at, leaving it reopens the task
// and bumps reopened_count, and a corresponding row is appended to
// task_events for downstream analytics.
import { z } from 'zod'
import { moveTask } from '../../../../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
})
const BodySchema = z.object({
  toColumnId: z.uuid(),
  toPosition: z.number().int().min(0),
  // Caller may opt out of WIP enforcement (typically for an admin override).
  force: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const task = await moveTask({
      workspaceId: id,
      taskId,
      toColumnId: body.toColumnId,
      toPosition: body.toPosition,
      actorId: user.id,
      actorRole: workspace.role,
      force: body.force,
    })
    return { task }
  } catch (err) {
    throw toHttpError(err)
  }
})
