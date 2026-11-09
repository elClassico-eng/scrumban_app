import { DEFAULT_APPEARANCE, type AppearancePrefs } from '#shared/types/appearance'

export function appearanceClasses(p: AppearancePrefs): string[] {
  const prefs = { ...DEFAULT_APPEARANCE, ...p }
  return [
    ...(prefs.compactCards ? ['takt-compact'] : []),
    ...(prefs.reduceMotion ? ['takt-reduce-motion'] : []),
  ]
}

export function resolveAppearance(server: AppearancePrefs | undefined, local: AppearancePrefs | null): Required<AppearancePrefs> | null {
  if (!server && !local) return null
  return { ...DEFAULT_APPEARANCE, ...server, ...local }
}
