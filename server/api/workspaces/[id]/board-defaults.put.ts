import { z } from 'zod'
import { getWorkspaceForUserOrThrow, setBoardDefaults } from '../../../services/workspaces.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'
import { SLE_PROBABILITIES } from '#shared/types/board-defaults'

const ParamsSchema = z.object({ id: z.uuid() })
const BodySchema = z.object({
  sleProbability: z.union(SLE_PROBABILITIES.map(p => z.literal(p))).optional(),
  replenishmentPeriodDays: z.number().int().min(1).max(60).optional(),
  columnTint: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const ws = await getWorkspaceForUserOrThrow(id, user.id)
    return { boardDefaults: await setBoardDefaults({ workspaceId: id, actorRole: ws.role, defaults: body }) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
