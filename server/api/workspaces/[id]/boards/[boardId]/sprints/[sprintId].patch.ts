// PATCH /api/workspaces/:id/boards/:boardId/sprints/:sprintId —
// rename / change goal / update planned dates (scrum_master+).
import { z } from 'zod'
import { updateSprint } from '../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

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
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.goal !== undefined ||
      d.plannedStartAt !== undefined ||
      d.plannedEndAt !== undefined,
    { message: 'Provide at least one field to update' },
  )

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const sprint = await updateSprint({
      workspaceId: id,
      sprintId,
      patch: {
        name: body.name,
        goal: body.goal,
        plannedStartAt:
          body.plannedStartAt === undefined
            ? undefined
            : body.plannedStartAt === null
              ? null
              : new Date(body.plannedStartAt),
        plannedEndAt:
          body.plannedEndAt === undefined
            ? undefined
            : body.plannedEndAt === null
              ? null
              : new Date(body.plannedEndAt),
      },
      actorRole: workspace.role,
    })
    return { sprint }
  } catch (err) {
    throw toHttpError(err)
  }
})
