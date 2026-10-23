import { z } from 'zod'
import { SHORTCUT_IDS } from '../types/shortcuts'

export const SHORTCUT_COMBO = /^(?:(?:meta|ctrl|alt|shift)_){0,3}[a-z0-9[\]]$|^[a-z0-9]-[a-z0-9]$/

export const ShortcutPrefsSchema = z.partialRecord(z.enum(SHORTCUT_IDS), z.string().regex(SHORTCUT_COMBO))
