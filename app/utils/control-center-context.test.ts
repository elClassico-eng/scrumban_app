import { describe, expect, it } from 'vitest'
import { resolveContextBoard } from './control-center-context'

const boards = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]

describe('resolveContextBoard', () => {
  it('prefers the route board', () => {
    expect(resolveContextBoard({ routeBoardId: 'b', lastBoardId: 'a', boards })).toBe('b')
  })

  it('falls back to the remembered board', () => {
    expect(resolveContextBoard({ routeBoardId: null, lastBoardId: 'b', boards })).toBe('b')
  })

  it('ignores a remembered board that no longer exists', () => {
    expect(resolveContextBoard({ routeBoardId: null, lastBoardId: 'zzz', boards })).toBe('a')
  })

  it('an explicit override beats the route board', () => {
    expect(resolveContextBoard({ routeBoardId: 'a', overrideBoardId: 'b', lastBoardId: null, boards })).toBe('b')
  })

  it('ignores an override that no longer exists', () => {
    expect(resolveContextBoard({ routeBoardId: 'a', overrideBoardId: 'zzz', lastBoardId: null, boards })).toBe('a')
  })

  it('returns null without boards', () => {
    expect(resolveContextBoard({ routeBoardId: null, lastBoardId: null, boards: [] })).toBeNull()
  })
})
