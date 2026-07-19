// POST /sprints/:sprintId/start — transition planned → active.
// At most one active sprint per board (enforced by partial unique index).
import { z } from 'zod'
import { takeSprintSnapshot } from '../../../../../../../services/forecast-snapshots.service'
import { startSprint } from '../../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'
import { publishBoardEvent } from '../../../../../../../utils/events'

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
    const sprint = await startSprint({
      workspaceId: id,
      sprintId,
      actorId: user.id,
      actorRole: workspace.role,
    })
    try {
      await takeSprintSnapshot({
        workspaceId: id,
        boardId,
        sprintId,
        trigger: 'sprint_start',
        actorRole: workspace.role,
      })
    } catch (err) {
      console.error('forecast snapshot on sprint start failed', err)
    }
    publishBoardEvent({ type: 'sprint.changed', workspaceId: id, boardId, payload: { sprintId, action: 'started' } })
    return { sprint }
  } catch (err) {
    throw toHttpError(err)
  }
})
