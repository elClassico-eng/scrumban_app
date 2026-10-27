import { z } from 'zod'
import { resolveFileRedirect } from '../../../services/files.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({ fileId: z.uuid() })
const QuerySchema = z.object({ thumb: z.string().optional(), download: z.string().optional() })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { fileId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const q = await getValidatedQuery(event, QuerySchema.parse)
    const { location, maxAge } = await resolveFileRedirect({ workspaceId: null, fileId, userId: user.id, thumb: q.thumb === '1', download: q.download === '1' })
    setHeader(event, 'cache-control', `private, max-age=${maxAge}`)
    return sendRedirect(event, location, 302)
  }
  catch (err) {
    throw toHttpError(err)
  }
})
