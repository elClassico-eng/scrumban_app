import { describe, expect, it } from 'vitest'
import { holdProgress } from './hold-progress'

describe('holdProgress', () => {
  it('grows linearly and clamps to 0..1', () => {
    expect(holdProgress(0, 2000)).toBe(0)
    expect(holdProgress(1000, 2000)).toBe(0.5)
    expect(holdProgress(5000, 2000)).toBe(1)
    expect(holdProgress(-5, 2000)).toBe(0)
  })
})
