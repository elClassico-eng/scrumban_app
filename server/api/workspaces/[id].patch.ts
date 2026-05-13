// PATCH /api/workspaces/:id — update workspace metadata (admin+).
// Only `name` is mutable right now; slug stays read-only because it's
// part of every URL and renaming it breaks external links.
import { z } from 'zod'
import { getWorkspaceForUserOrThrow, updateWorkspace } from '../../services/workspaces.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })
const BodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    purpose: z.string().trim().max(2000).nullable().optional(),
    industry: z.string().trim().max(100).nullable().optional(),
    logoUrl: z.url().max(2000).nullable().optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: 'Provide at least one field to update',
  })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const updated = await updateWorkspace({
      workspaceId: id,
      patch: body,
      actorRole: workspace.role,
    })
    return { workspace: updated }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
