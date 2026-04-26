// PATCH /api/workspaces/:id/members/:userId — change a member's role.
// Service layer enforces "actor must strictly outrank both the old and
// new role" plus "do not demote the last remaining owner".
import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { updateMemberRole } from '../../../../services/workspace-members.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), userId: z.uuid() })
const BodySchema = z.object({
  role: z.enum(['viewer', 'member', 'scrum_master', 'admin', 'owner']),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, userId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)

    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const member = await updateMemberRole({
      workspaceId: id,
      targetUserId: userId,
      newRole: body.role,
      actorRole: workspace.role,
      actorUserId: user.id,
    })
    return { member }
  } catch (err) {
    throw toHttpError(err)
  }
})
