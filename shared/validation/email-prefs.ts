import { z } from 'zod'
import { INSTANT_EMAIL_TYPES } from '../types/notification'

export const EmailPrefsSchema = z.object({
  digest: z.boolean(),
  instant: z.array(z.enum(INSTANT_EMAIL_TYPES)).max(INSTANT_EMAIL_TYPES.length)
    .refine(a => new Set(a).size === a.length, { message: 'Типы не должны повторяться' }),
})
