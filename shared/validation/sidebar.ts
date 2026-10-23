import { z } from 'zod'
import { SIDEBAR_FRAMES, SIDEBAR_ITEM_IDS } from '../types/sidebar'

const uniqueIds = z
  .array(z.uuid())
  .max(500)
  .refine(a => new Set(a).size === a.length, { message: 'Доски не должны повторяться' })

export const SidebarPrefsSchema = z.object({
  hidden: z.array(z.enum(SIDEBAR_ITEM_IDS)).max(SIDEBAR_ITEM_IDS.length).optional(),
  favorites: uniqueIds.optional(),
  boardOrder: uniqueIds.optional(),
  frame: z.enum(SIDEBAR_FRAMES).optional(),
})
