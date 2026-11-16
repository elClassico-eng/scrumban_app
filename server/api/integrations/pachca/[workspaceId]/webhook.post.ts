import { z } from 'zod'
import { handlePachcaWebhook } from '../../../../services/link-previews.service'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ workspaceId: z.uuid() })

export default defineEventHandler(async (event) => {
  try {
    const { workspaceId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const raw = (await readRawBody(event, 'utf8')) ?? ''
    await handlePachcaWebhook({ workspaceId, raw, signature: getHeader(event, 'pachca-signature') })
    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
