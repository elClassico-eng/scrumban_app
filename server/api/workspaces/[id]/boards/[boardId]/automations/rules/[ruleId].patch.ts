import { z } from 'zod'
import { RuleInputSchema } from '#shared/validation/automation'
import { getRule, updateRule } from '../../../../../../../services/automations.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../../utils/auth'
import { toHttpError } from '../../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid(), ruleId: z.uuid() })
const BodySchema = z.object({
  trigger: z.string().optional(),
  triggerParams: z.record(z.string(), z.unknown()).optional(),
  action: z.string().optional(),
  actionParams: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, ruleId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const touchesDefinition =
      body.trigger !== undefined ||
      body.triggerParams !== undefined ||
      body.action !== undefined ||
      body.actionParams !== undefined
    const patch = touchesDefinition
      ? RuleInputSchema.parse({ ...(await getRule({ workspaceId: id, ruleId, actorRole: workspace.role })), ...body })
      : { enabled: body.enabled }

    const rule = await updateRule({ workspaceId: id, ruleId, actorRole: workspace.role, patch })
    return { rule }
  } catch (err) {
    throw toHttpError(err)
  }
})
