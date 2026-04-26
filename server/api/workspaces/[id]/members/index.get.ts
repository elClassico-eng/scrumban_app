// GET /api/workspaces/:id/members — list everyone in the workspace with
// their email and role. Visible to any workspace member.
import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { listWorkspaceMembers } from '../../../../services/workspace-members.service'
import { requireAuth } from '../../../../utils/auth'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const members = await listWorkspaceMembers(id, workspace.role)
    return { members }
  } catch (err) {
    throw toHttpError(err)
  }
})
