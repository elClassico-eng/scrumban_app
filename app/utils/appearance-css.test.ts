import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE } from '#shared/types/appearance'
import { appearanceVars, resolveAppearance } from './appearance-css'

describe('appearanceVars', () => {
  it('no background means no classes', () => {
    expect(appearanceVars(DEFAULT_APPEARANCE).classes).toEqual([])
  })

  it('a preset sets the image and readability vars', () => {
    const r = appearanceVars({ background: { kind: 'preset', presetId: 'dusk' }, dim: 0.5, blur: 10 })
    expect(r.classes).toContain('takt-bg')
    expect(r.vars['--takt-bg-dim']).toBe('0.5')
    expect(r.vars['--takt-bg-blur']).toBe('10px')
    expect(r.vars['--takt-bg-image']).toBeTruthy()
  })

  it('a file uses its url', () => {
    const r = appearanceVars({ background: { kind: 'file', url: '/api/files/u/x' } })
    expect(r.vars['--takt-bg-image']).toBe('url("/api/files/u/x")')
    expect(r.vars['--takt-bg-dim']).toBe('0.4')
  })

  it('exposes the background tint for glass surfaces', () => {
    expect(appearanceVars({ background: { kind: 'file', url: '/x', color: '#112233' } }).vars['--takt-tint']).toBe('#112233')
    expect(appearanceVars({ background: { kind: 'preset', presetId: 'forest' } }).vars['--takt-tint']).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('interface toggles add their classes', () => {
    expect(appearanceVars({ reduceMotion: true, compactCards: true }).classes).toEqual(['takt-compact', 'takt-reduce-motion'])
  })
})

describe('resolveAppearance', () => {
  it('knows nothing before the profile loads and nothing was changed locally', () => {
    expect(resolveAppearance(undefined, null)).toBeNull()
  })

  it('local changes win over the server copy', () => {
    expect(resolveAppearance({ dim: 0.2, blur: 4 }, { dim: 0.6 })).toMatchObject({ dim: 0.6, blur: 4 })
  })

  it('fills defaults once the profile is known', () => {
    expect(resolveAppearance({}, null)).toEqual(DEFAULT_APPEARANCE)
  })
})
