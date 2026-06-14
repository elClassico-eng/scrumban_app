import { describe, expect, it } from 'vitest'
import {
  analyzeNetwork,
  buildEstimateCatalog,
  createSeededRng,
  normalCdf,
  probabilityWithin,
  sampleTriangular,
  simulateNetwork,
  type NetworkNode,
  type PertEstimate,
} from '../server/utils/network-planning'

const fixed = (days: number): PertEstimate => ({
  optimisticDays: days,
  mostLikelyDays: days,
  pessimisticDays: days,
})

const LEARNING_4_FIXED: NetworkNode[] = [
  { id: 'A', estimate: fixed(2), dependsOn: [] },
  { id: 'B', estimate: fixed(3), dependsOn: ['A'] },
  { id: 'C', estimate: fixed(2), dependsOn: ['A'] },
  { id: 'D', estimate: fixed(2), dependsOn: ['B', 'C'] },
]

const LEARNING_7_FIXED: NetworkNode[] = [
  { id: 'T1', estimate: fixed(1), dependsOn: [] },
  { id: 'T2', estimate: fixed(2), dependsOn: ['T1'] },
  { id: 'T3', estimate: fixed(3), dependsOn: ['T2'] },
  { id: 'T4', estimate: fixed(1), dependsOn: ['T3'] },
  { id: 'T5', estimate: fixed(3), dependsOn: ['T2'] },
  { id: 'T6', estimate: fixed(2), dependsOn: ['T4', 'T5'] },
  { id: 'T7', estimate: fixed(1), dependsOn: ['T6'] },
]

const LEARNING_4_PERT: NetworkNode[] = [
  { id: 'A', estimate: { optimisticDays: 1, mostLikelyDays: 2, pessimisticDays: 3 }, dependsOn: [] },
  { id: 'B', estimate: { optimisticDays: 2, mostLikelyDays: 3, pessimisticDays: 6 }, dependsOn: ['A'] },
  { id: 'C', estimate: { optimisticDays: 1, mostLikelyDays: 2, pessimisticDays: 4 }, dependsOn: ['A'] },
  { id: 'D', estimate: { optimisticDays: 1, mostLikelyDays: 2, pessimisticDays: 3 }, dependsOn: ['B', 'C'] },
]

describe('analyzeNetwork (CPM)', () => {
  it('computes the 4-task learning network: duration 7, slack of C = 1', () => {
    const result = analyzeNetwork(LEARNING_4_FIXED)
    expect(result.expectedDurationDays).toBeCloseTo(7, 6)
    expect(result.criticalPathIds).toEqual(['A', 'B', 'D'])
    const c = result.nodes.find(n => n.id === 'C')!
    expect(c.slackDays).toBeCloseTo(1, 6)
    expect(c.critical).toBe(false)
    expect(result.nodes.filter(n => n.critical).map(n => n.id).sort()).toEqual(['A', 'B', 'D'])
  })

  it('computes the 7-task learning network: duration 10, slack of T5 = 1', () => {
    const result = analyzeNetwork(LEARNING_7_FIXED)
    expect(result.expectedDurationDays).toBeCloseTo(10, 6)
    expect(result.criticalPathIds).toEqual(['T1', 'T2', 'T3', 'T4', 'T6', 'T7'])
    expect(result.nodes.find(n => n.id === 'T5')!.slackDays).toBeCloseTo(1, 6)
  })

  it('returns ES/EF/LS/LF consistent with the learning table', () => {
    const result = analyzeNetwork(LEARNING_4_FIXED)
    const byId = Object.fromEntries(result.nodes.map(n => [n.id, n]))
    expect(byId.A).toMatchObject({ earlyStart: 0, earlyFinish: 2, lateStart: 0, lateFinish: 2 })
    expect(byId.C).toMatchObject({ earlyStart: 2, earlyFinish: 4, lateStart: 3, lateFinish: 5 })
    expect(byId.D).toMatchObject({ earlyStart: 5, earlyFinish: 7 })
  })

  it('handles an empty network', () => {
    const result = analyzeNetwork([])
    expect(result.expectedDurationDays).toBe(0)
    expect(result.criticalPathIds).toEqual([])
  })

  it('ignores dependsOn references outside the node set', () => {
    const result = analyzeNetwork([{ id: 'X', estimate: fixed(5), dependsOn: ['ghost'] }])
    expect(result.expectedDurationDays).toBeCloseTo(5, 6)
    expect(result.criticalPathIds).toEqual(['X'])
  })

  it('throws on a cycle', () => {
    const cyclic: NetworkNode[] = [
      { id: 'A', estimate: fixed(1), dependsOn: ['B'] },
      { id: 'B', estimate: fixed(1), dependsOn: ['A'] },
    ]
    expect(() => analyzeNetwork(cyclic)).toThrow()
  })
})

describe('PERT probability', () => {
  it('normalCdf matches the reference table', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4)
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3)
    expect(normalCdf(1.64)).toBeCloseTo(0.9495, 3)
    expect(normalCdf(-0.41)).toBeCloseTo(0.341, 2)
  })

  it('reproduces the learning example: te 7.33, sigma 0.816, P(<=8) ~ 79%', () => {
    const analysis = analyzeNetwork(LEARNING_4_PERT)
    expect(analysis.expectedDurationDays).toBeCloseTo(7.333, 2)
    expect(analysis.criticalPathIds).toEqual(['A', 'B', 'D'])
    expect(analysis.sigmaDays).toBeCloseTo(0.8165, 3)
    expect(probabilityWithin(analysis, 8)).toBeCloseTo(0.7929, 2)
    expect(probabilityWithin(analysis, 7)).toBeCloseTo(0.3414, 2)
  })

  it('degenerates to a step function when sigma is 0', () => {
    const analysis = analyzeNetwork(LEARNING_4_FIXED)
    expect(probabilityWithin(analysis, 8)).toBe(1)
    expect(probabilityWithin(analysis, 6)).toBe(0)
  })
})

describe('simulateNetwork (MC-PERT)', () => {
  it('sampleTriangular stays in [O, P] and has mean (O+M+P)/3', () => {
    const rng = createSeededRng(42)
    const e: PertEstimate = { optimisticDays: 1, mostLikelyDays: 2, pessimisticDays: 4 }
    const samples = Array.from({ length: 20_000 }, () => sampleTriangular(e, rng))
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...samples)).toBeLessThanOrEqual(4)
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(mean).toBeCloseTo(7 / 3, 1)
  })

  it('simulates the learning network deterministically with a seed', () => {
    const rng = createSeededRng(42)
    const result = simulateNetwork(LEARNING_4_PERT, { iterations: 10_000, horizonDays: 8, rng })
    expect(result.iterations).toBe(10_000)
    expect(result.p50Days).toBeLessThan(result.p85Days)
    expect(result.p85Days).toBeLessThan(result.p95Days)
    expect(result.p50Days).toBeGreaterThan(6.8)
    expect(result.p50Days).toBeLessThan(8.6)
    expect(result.probabilityWithinHorizon).toBeGreaterThan(0.5)
    expect(result.probabilityWithinHorizon).toBeLessThan(0.75)
  })

  it('simulated probability is below the analytic PERT one (merge bias + distribution shape)', () => {
    const analysis = analyzeNetwork(LEARNING_4_PERT)
    const rng = createSeededRng(7)
    const result = simulateNetwork(LEARNING_4_PERT, { iterations: 10_000, horizonDays: 8, rng })
    expect(result.probabilityWithinHorizon!).toBeLessThan(probabilityWithin(analysis, 8))
  })

  it('returns probability 1 for an empty network with a horizon', () => {
    const result = simulateNetwork([], { iterations: 100, horizonDays: 5 })
    expect(result.probabilityWithinHorizon).toBe(1)
    expect(result.p95Days).toBe(0)
  })
})

describe('buildEstimateCatalog', () => {
  const mk = (storyPoints: number | null, cycleDays: number) => ({ storyPoints, cycleDays })

  it('uses the story-points bucket when it has >= 5 samples', () => {
    const samples = [
      ...[1, 1.2, 1.4, 1.6, 1.8].map(d => mk(3, d)),
      ...[5, 6, 7, 8, 9].map(d => mk(8, d)),
    ]
    const catalog = buildEstimateCatalog(samples)
    const resolved = catalog.estimateFor(3)!
    expect(resolved.source.kind).toBe('story_points_bucket')
    expect(resolved.source.sampleCount).toBe(5)
    expect(resolved.estimate.mostLikelyDays).toBeCloseTo(1.4, 6)
    expect(resolved.estimate.optimisticDays).toBeGreaterThanOrEqual(1)
    expect(resolved.estimate.pessimisticDays).toBeLessThanOrEqual(1.8)
  })

  it('falls back to the board-wide sample for unknown story points', () => {
    const samples = [1, 2, 3, 4, 5].map(d => mk(null, d))
    const catalog = buildEstimateCatalog(samples)
    const resolved = catalog.estimateFor(13)!
    expect(resolved.source.kind).toBe('board_global')
    expect(resolved.estimate.mostLikelyDays).toBeCloseTo(3, 6)
  })

  it('falls back to board-wide when the bucket is too thin', () => {
    const samples = [mk(3, 1), mk(3, 2), ...[1, 2, 3, 4, 5].map(d => mk(null, d))]
    const catalog = buildEstimateCatalog(samples)
    expect(catalog.estimateFor(3)!.source.kind).toBe('board_global')
  })

  it('returns null when there is not enough history at all', () => {
    const catalog = buildEstimateCatalog([mk(null, 1), mk(null, 2)])
    expect(catalog.estimateFor(null)).toBeNull()
    expect(catalog.totalSamples).toBe(2)
  })
})