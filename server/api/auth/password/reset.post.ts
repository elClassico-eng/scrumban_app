import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'
import { consumePasswordReset } from '../../../services/password-resets.service'
import { toHttpError } from '../../../utils/errors'

const ResetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
  password: passwordSchema,
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, ResetSchema.parse)

    const newHash = await hashPassword(body.password)
    const result = await consumePasswordReset(body.token, newHash)

    if (!result.ok) {
      const statusCode = result.reason === 'expired' ? 410 : 400
      const message
        = result.reason === 'expired' ? 'Ссылка устарела. Запросите новую.'
          : result.reason === 'already_used' ? 'Ссылка уже использована.'
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
