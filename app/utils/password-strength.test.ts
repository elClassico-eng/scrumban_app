import { describe, expect, it } from 'vitest'
import { passwordStrength } from './password-strength'

describe('passwordStrength mirrors the server rule and grades the rest', () => {
  it('empty is score 0 and invalid', () => {
    expect(passwordStrength('')).toMatchObject({ score: 0, valid: false })
  })

  it('10 chars with a letter and a digit is valid', () => {
    const r = passwordStrength('abcdefghi1')
    expect(r.valid).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(2)
  })

  it('no digit is invalid and says so', () => {
    const r = passwordStrength('abcdefghij')
    expect(r.valid).toBe(false)
    expect(r.hint).toContain('цифр')
  })

  it('long mixed password is the top score', () => {
    expect(passwordStrength('Abc1!xyz#Q9w').score).toBe(4)
  })
})
