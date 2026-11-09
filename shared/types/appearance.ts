export const BACKGROUND_PRESET_IDS = ['ember', 'dusk', 'forest', 'violet', 'sand'] as const
export type BackgroundPresetId = (typeof BACKGROUND_PRESET_IDS)[number]

export type AppearanceBackground =
  | { kind: 'none' }
  | { kind: 'preset', presetId: BackgroundPresetId }
  | { kind: 'file', url: string }

export type AppearancePrefs = {
  background?: AppearanceBackground
  dim?: number
  blur?: number
  compactCards?: boolean
  reduceMotion?: boolean
}

export const DEFAULT_APPEARANCE: Required<AppearancePrefs> = {
  background: { kind: 'none' },
  dim: 0.4,
  blur: 8,
  compactCards: false,
  reduceMotion: false,
}
