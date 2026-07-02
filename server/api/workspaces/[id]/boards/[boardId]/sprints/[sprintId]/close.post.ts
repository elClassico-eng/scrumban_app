// POST /sprints/:sprintId/close — transition planned/active → closed.
// Once closed, sprint membership freezes so velocity stays reproducible.
import { z } from 'zod'
import { takeSprintSnapshot } from '../../../../../../../services/forecast-snapshots.service'
import { closeSprint } from '../../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const sprint = await closeSprint({
      workspaceId: id,
      sprintId,
      actorRole: workspace.role,
    })
    try {
      await takeSprintSnapshot({
        workspaceId: id,
        boardId,
        sprintId,
        trigger: 'sprint_close',
        actorRole: workspace.role,
      })
    } catch (err) {
      console.error('forecast snapshot on sprint close failed', err)
    }
    return { sprint }
  } catch (err) {
    throw toHttpError(err)
  }
})
