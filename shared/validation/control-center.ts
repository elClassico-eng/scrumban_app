import { z } from 'zod'
import { TILE_IDS } from '../types/control-center'

const tiles = z
  .array(z.enum(TILE_IDS))
  .max(20)
  .refine((a) => new Set(a).size === a.length, { message: 'Плитки не должны повторяться' })

export const ControlCenterPrefsSchema = z.object({
  overview: tiles.optional(),
  flow: tiles.optional(),
  lastBoardId: z.uuid().nullable().optional(),
})
