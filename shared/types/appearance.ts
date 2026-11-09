export type AppearancePrefs = {
  compactCards?: boolean
  reduceMotion?: boolean
}

export const DEFAULT_APPEARANCE: Required<AppearancePrefs> = {
  compactCards: false,
  reduceMotion: false,
}
