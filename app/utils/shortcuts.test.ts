import { describe, expect, it } from 'vitest'
import { comboFromStrokes, conflictOf, describeCombo, effectiveCombos, isReserved, type KeyStroke } from './shortcuts'

const key = (code: string, mods: Partial<KeyStroke> = {}): KeyStroke =>
  ({ code, meta: false, ctrl: false, alt: false, shift: false, ...mods })

describe('describeCombo', () => {
  it('shows a chain as two keys pressed one after another', () => {
    expect(describeCombo('g-i')).toEqual({ keys: ['G', 'I'], chained: true })
  })

  it('shows modifiers as held together', () => {
    expect(describeCombo('meta_shift_k')).toEqual({ keys: ['⌘', 'Shift', 'K'], chained: false })
  })
})

describe('comboFromStrokes', () => {
  it('records physical keys, so a Russian layout still gives Latin letters', () => {
    expect(comboFromStrokes([key('KeyG'), key('KeyI')])).toBe('g-i')
  })

  it('records a single key and a modifier combo', () => {
    expect(comboFromStrokes([key('KeyN')])).toBe('n')
    expect(comboFromStrokes([key('KeyN', { shift: true })])).toBe('shift_n')
  })

  it('refuses keys it cannot store', () => {
    expect(comboFromStrokes([key('Space')])).toBeNull()
    expect(comboFromStrokes([key('KeyG'), key('KeyI', { meta: true })])).toBeNull()
  })
})

describe('conflicts', () => {
  it('uses user overrides on top of defaults', () => {
    expect(effectiveCombos({ go_inbox: 'g-n' }).go_inbox).toBe('g-n')
    expect(effectiveCombos({}).go_my_tasks).toBe('g-m')
  })

  it('flags an exact clash and a key that would swallow a chain', () => {
    expect(conflictOf('new_task', 'g-m', {})).toBe('go_my_tasks')
    expect(conflictOf('new_task', 'g', {})).toBe('go_inbox')
    expect(conflictOf('new_task', 'n', {})).toBeNull()
  })
})

describe('isReserved', () => {
  it('rejects combos the browser keeps for itself and the search shortcut', () => {
    expect(isReserved('meta_n')).toBe(true)
    expect(isReserved('meta_k')).toBe(true)
    expect(isReserved('shift_n')).toBe(false)
  })
})
