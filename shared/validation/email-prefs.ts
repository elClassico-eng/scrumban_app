import { z } from 'zod'
import { INSTANT_NOTIFICATION_TYPES } from '../types/notification'

export const EmailPrefsSchema = z.object({
  digest: z.boolean(),
  instant: z.array(z.enum(INSTANT_NOTIFICATION_TYPES)).max(INSTANT_NOTIFICATION_TYPES.length)
    .refine(a => new Set(a).size === a.length, { message: 'Типы не должны повторяться' }),
  digestHour: z.number().int().min(0).max(23).optional(),
})
