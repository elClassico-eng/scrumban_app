// PATCH /api/workspaces/:id/boards/:boardId/columns/:columnId — rename,
// change WIP limit, or change column_role (admin+). Position changes go
// through /columns/reorder so the unique (board_id, position) index is
// always valid mid-transaction.
import { z } from 'zod'
import { updateColumn } from '../../../../../../services/columns.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  columnId: z.uuid(),
})
const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    wipLimit: z.number().int().positive().nullable().optional(),
    columnRole: z
      .enum(['backlog', 'in_progress', 'review', 'done', 'archived'])
      .optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.wipLimit !== undefined || d.columnRole !== undefined,
    { message: 'Provide at least one field to update' },
  )

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, columnId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const column = await updateColumn({
      workspaceId: id,
      columnId,
      patch: body,
      actorRole: workspace.role,
    })
    return { column }
  } catch (err) {
    throw toHttpError(err)
  }
})
