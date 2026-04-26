// POST /api/workspaces/:id/members — add an *already registered* user
// to the workspace. Email-based invitations (with magic-link tokens) are
// deferred to a later phase; for now an admin/owner picks an existing
// user's email and assigns a role they themselves outrank.
import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { addMemberByEmail } from '../../../../services/workspace-members.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })
const BodySchema = z.object({
  email: z.email().max(255),
  role: z.enum(['viewer', 'member', 'scrum_master', 'admin', 'owner']),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)

    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const member = await addMemberByEmail({
      workspaceId: id,
      email: body.email,
      role: body.role,
      actorRole: workspace.role,
    })
    return { member }
  } catch (err) {
    throw toHttpError(err)
  }
})
