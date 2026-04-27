// POST /api/workspaces/:id/boards/:boardId/columns — append a new column
// to the board (admin+). Position is auto-assigned at the end; reorder
// via the dedicated /columns/reorder endpoint.
import { z } from 'zod'
import { createColumn } from '../../../../../../services/columns.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const BodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  columnRole: z.enum(['backlog', 'in_progress', 'review', 'done', 'archived']),
  wipLimit: z.number().int().positive().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const column = await createColumn({
      workspaceId: id,
      boardId,
      name: body.name,
      columnRole: body.columnRole,
      wipLimit: body.wipLimit ?? null,
      actorRole: workspace.role,
    })
    return { column }
  } catch (err) {
    throw toHttpError(err)
  }
})
