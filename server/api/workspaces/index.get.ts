// GET /api/workspaces — list workspaces the current user is a member of,
// each annotated with the user's role within that workspace.
import { listWorkspacesForUser } from '../../services/workspaces.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const workspaces = await listWorkspacesForUser(user.id)
    return { workspaces }
  } catch (err) {
    throw toHttpError(err)
  }
})
