import { describe, expect, it } from 'vitest'
import { bucketAge } from '../shared/utils/daily'

describe('bucketAge', () => {
  it('overdue когда возраст больше P85', () => {
    expect(bucketAge(12, 10)).toBe('overdue')
  })

  it('approaching в зоне 0.7*P85..P85', () => {
    expect(bucketAge(7, 10)).toBe('approaching')
    expect(bucketAge(10, 10)).toBe('approaching')
  })

  it('fresh ниже 0.7*P85', () => {
    expect(bucketAge(6.9, 10)).toBe('fresh')
    expect(bucketAge(0, 10)).toBe('fresh')
  })

  it('p85=null или 0 — всегда fresh', () => {
    expect(bucketAge(100, null)).toBe('fresh')
    expect(bucketAge(100, 0)).toBe('fresh')
  })
})
