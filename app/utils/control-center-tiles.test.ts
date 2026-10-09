import { describe, expect, it } from 'vitest'
import { DEFAULT_TILES, normalizeTiles, TILE_CATALOG } from './control-center-tiles'

describe('normalizeTiles', () => {
  it('drops unknown ids and duplicates', () => {
    expect(normalizeTiles(['timer', 'nope', 'timer', 'firings'], 'overview')).toEqual(['timer', 'firings'])
  })

  it('falls back to defaults when empty or not an array', () => {
    expect(normalizeTiles(undefined, 'flow')).toEqual(DEFAULT_TILES.flow)
    expect(normalizeTiles([], 'overview')).toEqual(DEFAULT_TILES.overview)
    expect(normalizeTiles('timer', 'overview')).toEqual(DEFAULT_TILES.overview)
  })

  it('keeps only tiles of the requested tab', () => {
    expect(normalizeTiles(['wip', 'timer'], 'overview')).toEqual(['timer'])
  })

  it('catalog covers every default', () => {
    for (const id of [...DEFAULT_TILES.overview, ...DEFAULT_TILES.flow]) expect(TILE_CATALOG[id]).toBeDefined()
  })
})
