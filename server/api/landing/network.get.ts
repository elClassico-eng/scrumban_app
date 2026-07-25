import {
  buildForecast,
  buildSprintNodes,
  buildTaskViews,
  computeHorizonDays,
} from '../../services/network-forecast.service'
import { toHttpError } from '../../utils/errors'
import { createSeededRng } from '../../utils/network-planning'
import { buildSandboxData, SANDBOX_SPRINT_ID } from '../../utils/sandbox-fixture'

export default defineEventHandler(async (event) => {
  try {
    const data = buildSandboxData()
    const built = buildSprintNodes(data)!
    const horizonDays = computeHorizonDays(data.sprint)
    const core = buildForecast(built.nodes, horizonDays, { rng: createSeededRng(20260710) })
    const meta = new Map(data.remaining.map(r => [r.taskId, { title: r.title, storyPoints: r.storyPoints }]))

    setResponseHeader(event, 'cache-control', 'public, max-age=300, s-maxage=300')

    return {
      sprintId: SANDBOX_SPRINT_ID,
      horizonDays: horizonDays === null ? null : Math.round(horizonDays * 100) / 100,
      edgeCount: data.edges.length,
      closedSamples: data.history.length,
      tasks: buildTaskViews(built.nodes, core.analysis, meta, built.sources),
      criticalPathIds: core.analysis.criticalPathIds,
      pert: core.pert,
      simulation: core.simulation,
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
