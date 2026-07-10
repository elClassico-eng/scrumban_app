import { z } from 'zod'
import { computeScenarioReport } from '../../../services/sprint-scenarios.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'
import { buildSandboxData } from '../../../utils/sandbox-fixture'
import { ScenarioChangesSchema } from '../../../utils/scenario-changes'

const BodySchema = z.object({ changes: ScenarioChangesSchema })

export default defineEventHandler(async (event) => {
  try {
    await requireAuth(event)
    const { changes } = await readValidatedBody(event, BodySchema.parse)
    return computeScenarioReport(buildSandboxData(), changes)
  }
  catch (err) {
    throw toHttpError(err)
  }
})
