import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE } from '#shared/types/appearance'
import { appearanceClasses, resolveAppearance } from './appearance-css'

describe('appearanceClasses', () => {
  it('defaults add nothing', () => {
    expect(appearanceClasses(DEFAULT_APPEARANCE)).toEqual([])
  })

  it('interface toggles add their classes', () => {
    expect(appearanceClasses({ reduceMotion: true, compactCards: true })).toEqual(['takt-compact', 'takt-reduce-motion'])
  })
})

describe('resolveAppearance', () => {
  it('knows nothing before the profile loads and nothing was changed locally', () => {
    expect(resolveAppearance(undefined, null)).toBeNull()
  })

  it('local changes win over the server copy', () => {
    expect(resolveAppearance({ compactCards: false, reduceMotion: true }, { compactCards: true })).toEqual({ compactCards: true, reduceMotion: true })
  })

  it('fills defaults once the profile is known', () => {
    expect(resolveAppearance({}, null)).toEqual(DEFAULT_APPEARANCE)
  })
})
