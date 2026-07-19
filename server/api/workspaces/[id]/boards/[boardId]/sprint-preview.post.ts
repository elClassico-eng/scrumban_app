import { z } from 'zod'
import { computeSprintPreview } from '../../../../../services/sprint-preview.service'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
})

const BodySchema = z.object({
  taskIds: z.array(z.uuid()).min(1).max(200),
  plannedStartAt: z.iso.datetime().nullable().optional(),
  plannedEndAt: z.iso.datetime().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    return await computeSprintPreview({
      workspaceId: id,
      boardId,
      taskIds: body.taskIds,
      plannedStartAt: body.plannedStartAt ? new Date(body.plannedStartAt) : null,
      plannedEndAt: body.plannedEndAt ? new Date(body.plannedEndAt) : null,
      actorRole: workspace.role,
    })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
