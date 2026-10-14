import { describe, expect, it } from 'vitest'
import { ROLE_HEX, columnHex } from './column-color'

describe('columnHex', () => {
  it('falls back to the role color', () => {
    expect(columnHex({ color: null, columnRole: 'review' })).toBe(ROLE_HEX.review)
  })
  it('prefers an explicit color', () => {
    expect(columnHex({ color: '#3b82f6', columnRole: 'review' })).toBe('#3b82f6')
  })
})
