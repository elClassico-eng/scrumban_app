// DELETE /api/workspaces/:id/members/:userId — remove a member.
// Self-removal is allowed; otherwise actor must strictly outrank target.
// The last owner cannot be removed (would orphan the workspace).
import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { removeMember } from '../../../../services/workspace-members.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), userId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, userId } = await getValidatedRouterParams(event, ParamsSchema.parse)

    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    await removeMember({
      workspaceId: id,
      targetUserId: userId,
      actorRole: workspace.role,
      actorUserId: user.id,
    })
    setResponseStatus(event, 204)
    return null
  } catch (err) {
    throw toHttpError(err)
  }
})
