import { z } from 'zod'
import { getBoard } from '../../../../../../services/boards.service'
import { computeBoardForecastCalibration } from '../../../../../../services/forecast-snapshots.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { sendExport } from '../../../../../../utils/export'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const QuerySchema = z.object({ format: z.enum(['csv', 'json']).default('csv') })

const COLUMNS = [
  'sprintId', 'sprintName', 'startedAt', 'endedAt', 'p50Days', 'p85Days', 'p95Days',
  'actualDays', 'outcome', 'p50Hit', 'p85Hit', 'doneCount', 'totalCount', 'carriedCount', 'doneSp', 'totalSp',
].map((key) => ({ key, header: key }))

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const { format } = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)
    const board = await getBoard({ workspaceId: id, boardId, actorRole: workspace.role })
    const report = await computeBoardForecastCalibration({ workspaceId: id, boardId, actorRole: workspace.role })
    return sendExport(event, { rows: report.rows, columns: COLUMNS, format, name: `forecast-calibration-${board.slug}` })
  }
  catch (err) {
    throw toHttpError(err)
  }
})
