import { z } from 'zod'
import { updateEntry } from '../../../../../../../../services/time-tracking.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  taskId: z.uuid(),
  entryId: z.uuid(),
})

const BodySchema = z.object({
  startedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().positive().optional(),
  description: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, entryId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const row = await updateEntry({
      workspaceId: id,
      boardId,
      entryId,
      actorId: user.id,
      actorRole: workspace.role,
      patch: body,
    })

    return { entry: { ...row, running: false, elapsedSeconds: row.durationSeconds! } }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
