// POST /api/workspaces/:id/boards/:boardId/sprints — create a planned
// sprint (scrum_master+). Optional planned start/end window for the
// burndown chart's reference.
import { z } from 'zod'
import { createSprint } from '../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const BodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  goal: z.string().max(10_000).optional(),
  plannedStartAt: z.iso.datetime().optional().nullable(),
  plannedEndAt: z.iso.datetime().optional().nullable(),
  capacity: z.number().int().min(0).max(10_000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const sprint = await createSprint({
      workspaceId: id,
      boardId,
      name: body.name,
      goal: body.goal,
      plannedStartAt: body.plannedStartAt ? new Date(body.plannedStartAt) : null,
      plannedEndAt: body.plannedEndAt ? new Date(body.plannedEndAt) : null,
      capacity: body.capacity,
      actorRole: workspace.role,
    })
    return { sprint }
  } catch (err) {
    throw toHttpError(err)
  }
})
