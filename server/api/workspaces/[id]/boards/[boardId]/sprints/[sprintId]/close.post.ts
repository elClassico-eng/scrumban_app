// POST /sprints/:sprintId/close — transition planned/active → closed.
// Once closed, sprint membership freezes so velocity stays reproducible.
import { z } from 'zod'
import { takeSprintSnapshot } from '../../../../../../../services/forecast-snapshots.service'
import { generateSprintReport } from '../../../../../../../services/sprint-reports.service'
import { closeSprint } from '../../../../../../../services/sprints.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

const ParamsSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  sprintId: z.uuid(),
})

const BodySchema = z
  .object({
    goalAchieved: z.boolean().nullable().optional(),
    goalComment: z.string().max(2000).optional(),
    carryOver: z
      .array(
        z.object({
          taskId: z.uuid(),
          decision: z.enum(['next_sprint', 'backlog', 'keep']),
        }),
      )
      .max(500)
      .optional(),
  })
  .optional()

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId, sprintId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const body = (await readValidatedBody(event, BodySchema.parse)) ?? {}
    const sprint = await closeSprint({
      workspaceId: id,
      sprintId,
      actorId: user.id,
      actorRole: workspace.role,
      goalAchieved: body.goalAchieved ?? null,
      goalComment: body.goalComment,
      carryOver: body.carryOver,
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
    try {
      await generateSprintReport({
        workspaceId: id,
        sprintId,
        actorId: user.id,
        actorRole: workspace.role,
      })
    } catch (err) {
      console.error('sprint report generation on close failed', err)
    }
    return { sprint }
  } catch (err) {
    throw toHttpError(err)
  }
})
