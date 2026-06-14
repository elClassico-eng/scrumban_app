// POST /api/workspaces/:id/boards — create a board (admin+).
// slug is unique within a workspace and follows the same URL-safe pattern
// as workspace slug.
import { z } from 'zod'
import { BOARD_COLOR_RE } from '#shared/constants/board-colors'
import { createBoard } from '../../../../services/boards.service'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

const ParamsSchema = z.object({ id: z.uuid() })
const BodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().toLowerCase().min(3).max(64).regex(SLUG_RE, {
    message: 'slug must be lowercase letters, digits, and hyphens',
  }),
  color: z.string().regex(BOARD_COLOR_RE, { message: 'color must be a hex like #e85002' }).optional(),
  // When false, the board is created without the default 4 columns
  // (Backlog/In Progress/Review/Done). Useful for teams that want to
  // configure their own kanban flow from scratch.
  seedDefaults: z.boolean().optional().default(true),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)

    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const board = await createBoard({
      workspaceId: id,
      name: body.name,
      slug: body.slug,
      color: body.color,
      seedDefaults: body.seedDefaults,
      actorRole: workspace.role,
    })
    return { board }
  } catch (err) {
    throw toHttpError(err)
  }
})
