import { z } from 'zod'
import { BACKGROUND_PRESET_IDS } from '../types/appearance'

export const AppearancePrefsSchema = z.object({
  background: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({ kind: z.literal('preset'), presetId: z.enum(BACKGROUND_PRESET_IDS) }),
  ]).optional(),
  dim: z.number().min(0).max(0.8).optional(),
  blur: z.number().min(0).max(20).optional(),
  compactCards: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
})
