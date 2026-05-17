import { z } from 'zod'
import { consumeVerification } from '../../../services/email-verifications.service'
import { toHttpError } from '../../../utils/errors'

const ParamsSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
})

export default defineEventHandler(async (event) => {
  try {
    const { token } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const result = await consumeVerification(token)

    if (!result.ok) {
      const statusCode = result.reason === 'expired' ? 410 : 400
      const message
        = result.reason === 'expired' ? 'Ссылка устарела. Запросите новую.'
          : result.reason === 'already_used' ? 'Email уже подтверждён.'
            : 'Ссылка недействительна.'
      throw createError({
        statusCode,
        statusMessage: message,
        data: { message, reason: result.reason },
      })
    }

    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})