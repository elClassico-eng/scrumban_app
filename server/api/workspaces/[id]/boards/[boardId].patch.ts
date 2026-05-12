// PATCH /api/workspaces/:id/boards/:boardId — rename / change slug (admin+).
import { z } from 'zod'
import { updateBoard } from '../../../../services/boards.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    slug: z.string().trim().toLowerCase().min(3).max(64).regex(SLUG_RE).optional(),
    sleDays: z.number().int().positive().nullable().optional(),
    sleProbability: z.number().min(0.5).max(0.99).optional(),
    replenishmentPeriodDays: z.number().int().positive().max(60).optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.slug !== undefined ||
      d.sleDays !== undefined ||
      d.sleProbability !== undefined ||
      d.replenishmentPeriodDays !== undefined,
    { message: 'Provide at least one field to update' },
  )

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const board = await updateBoard({
      workspaceId: id,
      boardId,
      patch: {
        name: body.name,
        slug: body.slug,
        ...('sleDays' in body ? { sleDays: body.sleDays } : {}),
        // numeric(3,2) is text in postgres-js; coerce.
        ...(body.sleProbability !== undefined
          ? { sleProbability: body.sleProbability.toFixed(2) }
          : {}),
        replenishmentPeriodDays: body.replenishmentPeriodDays,
      },
      actorRole: workspace.role,
    })
    return { board }
  } catch (err) {
    throw toHttpError(err)
  }
})
