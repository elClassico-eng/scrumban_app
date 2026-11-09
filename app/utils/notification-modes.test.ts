import { describe, expect, it } from 'vitest'
import {
  cellEnabled,
  detectMode,
  matrixForMode,
  pachcaCellState,
  type ChannelMatrix,
  type NotificationMode,
} from '#shared/utils/notification-modes'

const base = matrixForMode('all', { bell: {} as ChannelMatrix['bell'], email: [], pachca: [] })

describe('notification modes', () => {
  it('every preset is recognised back', () => {
    for (const mode of ['all', 'important', 'mine', 'quiet'] as NotificationMode[]) {
      expect(detectMode(matrixForMode(mode, base))).toBe(mode)
    }
  })

  it('quiet keeps the bell as it was', () => {
    const mine = matrixForMode('mine', base)
    expect(matrixForMode('quiet', mine).bell).toEqual(mine.bell)
  })

  it('without Pachca links the Pachca column is ignored', () => {
    const mine = { ...matrixForMode('mine', base), pachca: [] }
    expect(detectMode(mine, { ignorePachca: true })).toBe('mine')
    expect(detectMode({ ...matrixForMode('important', base), pachca: [] }, { ignorePachca: true })).toBe('important')
  })

  it('mixed Pachca links are always custom', () => {
    const quiet = matrixForMode('quiet', base)
    expect(detectMode(quiet, { pachcaMixed: true })).toBe('custom')
    expect(detectMode(matrixForMode('all', base), { pachcaMixed: true })).toBe('custom')
  })

  it('a hand edit turns the mode into custom', () => {
    const m = matrixForMode('important', base)
    expect(detectMode({ ...m, email: [...m.email, 'reply'] })).toBe('custom')
  })
})

describe('cellEnabled', () => {
  it('the bell gates email and Pachca', () => {
    const m = { ...base, bell: { ...base.bell, mention: false } }
    expect(cellEnabled(m, 'mention', 'email')).toBe(false)
    expect(cellEnabled(m, 'mention', 'pachca')).toBe(false)
    expect(cellEnabled(base, 'mention', 'email')).toBe(true)
  })

  it('non-instant types have no email or Pachca cell', () => {
    expect(cellEnabled(base, 'sle_breach', 'email')).toBe(false)
  })
})

describe('pachcaCellState', () => {
  it('reports mixed links', () => {
    expect(pachcaCellState([{ instantTypes: ['mention'] }, { instantTypes: [] }], 'mention')).toBe('mixed')
    expect(pachcaCellState([{ instantTypes: [] }, { instantTypes: [] }], 'mention')).toBe('off')
    expect(pachcaCellState([{ instantTypes: ['mention'] }], 'mention')).toBe('on')
  })
})
