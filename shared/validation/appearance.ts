import { z } from 'zod'

export const AppearancePrefsSchema = z.object({
  compactCards: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
})
