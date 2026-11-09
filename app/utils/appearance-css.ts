import { DEFAULT_APPEARANCE, type AppearancePrefs, type BackgroundPresetId } from '#shared/types/appearance'

export const BACKGROUND_PRESETS: Record<BackgroundPresetId, { label: string, image: string, tint: string }> = {
  ember: { label: 'Угли', image: 'radial-gradient(120% 90% at 20% 15%, #ff7a3d 0%, #b8360a 35%, #2a0b02 70%, #0d0402 100%)', tint: '#a8401a' },
  dusk: { label: 'Сумерки', image: 'linear-gradient(160deg, #1e3a5f 0%, #0b1d2e 45%, #3a2a1a 100%)', tint: '#1f3550' },
  forest: { label: 'Лес', image: 'radial-gradient(110% 80% at 80% 10%, #3f7d58 0%, #1d4a33 40%, #0a1410 100%)', tint: '#2a5a40' },
  violet: { label: 'Фиалка', image: 'linear-gradient(200deg, #6d4bb3 0%, #2a1f4d 45%, #0a0814 100%)', tint: '#4b3680' },
  sand: { label: 'Песок', image: 'linear-gradient(170deg, #f2d6b3 0%, #c98b5b 50%, #5b3a24 100%)', tint: '#c98b5b' },
}

const NEUTRAL_TINT = '#808080'

export type AppearanceCss = { classes: string[], vars: Record<string, string> }

export function appearanceVars(p: AppearancePrefs): AppearanceCss {
  const prefs = { ...DEFAULT_APPEARANCE, ...p }
  const bg = prefs.background
  const image = bg.kind === 'preset' ? BACKGROUND_PRESETS[bg.presetId].image : bg.kind === 'file' ? `url("${bg.url}")` : null
  const tint = bg.kind === 'preset' ? BACKGROUND_PRESETS[bg.presetId].tint : bg.kind === 'file' ? bg.color ?? NEUTRAL_TINT : NEUTRAL_TINT
  return {
    classes: [
      ...(image ? ['takt-bg'] : []),
      ...(prefs.compactCards ? ['takt-compact'] : []),
      ...(prefs.reduceMotion ? ['takt-reduce-motion'] : []),
    ],
    vars: image
      ? { '--takt-bg-image': image, '--takt-bg-dim': String(prefs.dim), '--takt-bg-blur': `${prefs.blur}px`, '--takt-tint': tint }
      : {},
  }
}

export function resolveAppearance(server: AppearancePrefs | undefined, local: AppearancePrefs | null): Required<AppearancePrefs> | null {
  if (!server && !local) return null
  return { ...DEFAULT_APPEARANCE, ...server, ...local }
}
