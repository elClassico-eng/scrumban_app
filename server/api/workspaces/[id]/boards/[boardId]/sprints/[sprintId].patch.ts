// PATCH /api/workspaces/:id/boards/:boardId/sprints/:sprintId —
// rename / change goal / update planned dates (scrum_master+).
import { z } from 'zod'
import { updateSprint } from '../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'
import { publishBoardEvent } from '../../../../../../utils/events'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
})
const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    goal: z.string().max(10_000).optional(),
    plannedStartAt: z.iso.datetime().nullable().optional(),
    plannedEndAt: z.iso.datetime().nullable().optional(),
    capacity: z.number().int().min(0).max(10_000).nullable().optional(),
    datesChangeReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.goal !== undefined ||
      d.plannedStartAt !== undefined ||
      d.plannedEndAt !== undefined ||
      d.capacity !== undefined,
    { message: 'Provide at least one field to update' },
  )

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const sprint = await updateSprint({
      workspaceId: id,
      sprintId,
      patch: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.goal !== undefined ? { goal: body.goal } : {}),
        ...(body.plannedStartAt !== undefined
          ? { plannedStartAt: body.plannedStartAt === null ? null : new Date(body.plannedStartAt) }
          : {}),
        ...(body.plannedEndAt !== undefined
          ? { plannedEndAt: body.plannedEndAt === null ? null : new Date(body.plannedEndAt) }
          : {}),
        ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      },
      datesChangeReason: body.datesChangeReason,
      actorId: user.id,
      actorRole: workspace.role,
    })
    publishBoardEvent({ type: 'sprint.changed', workspaceId: id, boardId, payload: { sprintId, action: 'updated' } })
    return { sprint }
  } catch (err) {
    throw toHttpError(err)
  }
})
