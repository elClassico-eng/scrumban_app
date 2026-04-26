// POST /api/workspaces — create a new workspace; current user becomes Owner.
// slug is restricted to URL-safe lowercase identifiers and enforced unique
// at the DB level (returns 409 on collision via ConflictError).
import { z } from 'zod'
import { createWorkspace } from '../../services/workspaces.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().toLowerCase().min(3).max(64).regex(SLUG_RE, {
    message: 'slug must be lowercase letters, digits, and hyphens',
  }),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body = await readValidatedBody(event, CreateWorkspaceSchema.parse)
    const ws = await createWorkspace({ ...body, ownerId: user.id })
    return { workspace: ws }
  } catch (err) {
    throw toHttpError(err)
  }
})
