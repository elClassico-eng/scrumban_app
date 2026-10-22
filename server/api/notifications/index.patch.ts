import { z } from 'zod'
import { updateMany } from '../../services/notifications.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const BodySchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(500),
    read: z.boolean().optional(),
    cleared: z.boolean().optional(),
    snoozedUntil: z.coerce.date().nullable().optional(),
  })
  .refine(d => d.read !== undefined || d.cleared !== undefined || d.snoozedUntil !== undefined, {
    message: 'Укажите read, cleared или snoozedUntil',
  })

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const body = await readValidatedBody(event, BodySchema.parse)
    const count = await updateMany({ userId: user.id, ...body })
    return { count }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
