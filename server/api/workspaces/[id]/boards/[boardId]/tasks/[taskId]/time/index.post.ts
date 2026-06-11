import { z } from 'zod'
import { createManualEntry } from '../../../../../../../../services/time-tracking.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
})

const BodySchema = z.object({
  startedAt: z.string().datetime(),
  durationSeconds: z.number().int().positive(),
  description: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, taskId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const entry = await createManualEntry({
      workspaceId: id,
      boardId,
      taskId,
      userId: user.id,
      actorRole: workspace.role,
      startedAt: body.startedAt,
      durationSeconds: body.durationSeconds,
      description: body.description,
    })

    return { entry: { ...entry, running: false, elapsedSeconds: entry.durationSeconds! } }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
