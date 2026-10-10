import { z } from 'zod'
import { getBoard } from '../../../../../../services/boards.service'
import { listBoardForecastJournal } from '../../../../../../services/forecast-snapshots.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { sendExport } from '../../../../../../utils/export'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const QuerySchema = z.object({ format: z.enum(['csv', 'json']).default('csv') })

const COLUMNS = [
  'sprintId', 'sprintName', 'trigger', 'takenAt', 'p50Days', 'p85Days', 'p95Days',
  'networkProbability', 'naiveProbability', 'pertExpectedDays', 'pertSigmaDays',
  'remainingCount', 'committedSp', 'horizonDays', 'closedSamples', 'edgeCount',
].map((key) => ({ key, header: key }))

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const { format } = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const board = await getBoard({ workspaceId: id, boardId, actorRole: workspace.role })
    const journal = await listBoardForecastJournal({ workspaceId: id, boardId, actorRole: workspace.role })
    const rows = journal.sprints.flatMap((s) =>
      s.snapshots.map((x) => ({
        sprintId: s.sprint.id,
        sprintName: s.sprint.name,
        trigger: x.trigger,
        takenAt: x.takenAt,
        p50Days: x.payload.simulation.p50Days,
        p85Days: x.payload.simulation.p85Days,
        p95Days: x.payload.simulation.p95Days,
        networkProbability: x.payload.simulation.probabilityWithinHorizon,
        naiveProbability: x.payload.naiveProbability,
        pertExpectedDays: x.payload.pert.expectedDurationDays,
        pertSigmaDays: x.payload.pert.sigmaDays,
        remainingCount: x.payload.remainingCount,
        committedSp: x.payload.committedSp,
        horizonDays: x.payload.horizonDays,
        closedSamples: x.payload.closedSamples,
        edgeCount: x.payload.edgeCount,
      })),
    )
    return sendExport(event, { rows, columns: COLUMNS, format, name: `forecast-journal-${board.slug}` })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
