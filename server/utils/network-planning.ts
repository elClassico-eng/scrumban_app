export type PertEstimate = {
  optimisticDays: number
  mostLikelyDays: number
  pessimisticDays: number
}

export type NetworkNode = {
  id: string
  estimate: PertEstimate
  dependsOn: string[]
}

export type AnalyzedNode = {
  id: string
  expectedDays: number
  sigma2: number
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  slackDays: number
  critical: boolean
}

export type NetworkAnalysis = {
  nodes: AnalyzedNode[]
  expectedDurationDays: number
  sigmaDays: number
  criticalPathIds: string[]
}

const EPSILON = 1e-6

export function pertExpectedDays(e: PertEstimate): number {
  return (e.optimisticDays + 4 * e.mostLikelyDays + e.pessimisticDays) / 6
}

export function pertSigmaDays(e: PertEstimate): number {
  return (e.pessimisticDays - e.optimisticDays) / 6
}

export function analyzeNetwork(nodes: NetworkNode[]): NetworkAnalysis {
  if (nodes.length === 0) {
    return { nodes: [], expectedDurationDays: 0, sigmaDays: 0, criticalPathIds: [] }
  }

  const byId = new Map(nodes.map(n => [n.id, n]))
  const order = topologicalOrder(nodes, byId)

  const dependentsOf = new Map<string, string[]>()
  for (const n of nodes) {
    for (const d of n.dependsOn) {
      if (!byId.has(d)) continue
      dependentsOf.set(d, [...(dependentsOf.get(d) ?? []), n.id])
    }
  }

  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  for (const id of order) {
    const n = byId.get(id)!
    const start = Math.max(0, ...n.dependsOn.filter(d => byId.has(d)).map(d => ef.get(d)!))
    es.set(id, start)
    ef.set(id, start + pertExpectedDays(n.estimate))
  }
  const duration = Math.max(...order.map(id => ef.get(id)!))

  const lf = new Map<string, number>()
  const ls = new Map<string, number>()
  for (const id of [...order].reverse()) {
    const deps = dependentsOf.get(id) ?? []
    const finish = deps.length === 0 ? duration : Math.min(...deps.map(d => ls.get(d)!))
    lf.set(id, finish)
    ls.set(id, finish - pertExpectedDays(byId.get(id)!.estimate))
  }

  const analyzed: AnalyzedNode[] = order.map((id) => {
    const slack = ls.get(id)! - es.get(id)!
    return {
      id,
      expectedDays: pertExpectedDays(byId.get(id)!.estimate),
      sigma2: pertSigmaDays(byId.get(id)!.estimate) ** 2,
      earlyStart: es.get(id)!,
      earlyFinish: ef.get(id)!,
      lateStart: ls.get(id)!,
      lateFinish: lf.get(id)!,
      slackDays: slack,
      critical: slack <= EPSILON,
    }
  })

  const criticalPathIds = extractCriticalChain(analyzed, dependentsOf)
  const chainSet = new Set(criticalPathIds)
  const sigma2Total = analyzed
    .filter(n => chainSet.has(n.id))
    .reduce((acc, n) => acc + n.sigma2, 0)

  return {
    nodes: analyzed,
    expectedDurationDays: duration,
    sigmaDays: Math.sqrt(sigma2Total),
    criticalPathIds,
  }
}

function topologicalOrder(nodes: NetworkNode[], byId: Map<string, NetworkNode>): string[] {
  const indegree = new Map<string, number>()
  const dependentsOf = new Map<string, string[]>()
  for (const n of nodes) {
    const deps = n.dependsOn.filter(d => byId.has(d))
    indegree.set(n.id, deps.length)
    for (const d of deps) dependentsOf.set(d, [...(dependentsOf.get(d) ?? []), n.id])
  }
  const queue = nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id)
  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const dep of dependentsOf.get(id) ?? []) {
      const left = indegree.get(dep)! - 1
      indegree.set(dep, left)
      if (left === 0) queue.push(dep)
    }
  }
  if (order.length !== nodes.length) {
    throw new Error('Cycle in dependency network')
  }
  return order
}

function extractCriticalChain(
  analyzed: AnalyzedNode[],
  dependentsOf: Map<string, string[]>,
): string[] {
  const byId = new Map(analyzed.map(n => [n.id, n]))
  const starts = analyzed.filter(n => n.critical && n.earlyStart <= EPSILON)
  if (starts.length === 0) return []
  let current = starts.reduce((a, b) => (b.earlyFinish > a.earlyFinish ? b : a))
  const chain = [current.id]
  for (;;) {
    const next = (dependentsOf.get(current.id) ?? [])
      .map(id => byId.get(id)!)
      .filter(n => n.critical && Math.abs(n.earlyStart - current.earlyFinish) <= EPSILON)
      .sort((a, b) => b.earlyFinish - a.earlyFinish)[0]
    if (!next) break
    chain.push(next.id)
    current = next
  }
  return chain
}

export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const p = 1 - d * poly
  return z >= 0 ? p : 1 - p
}

export function probabilityWithin(analysis: NetworkAnalysis, horizonDays: number): number {
  if (analysis.sigmaDays <= 0) {
    return analysis.expectedDurationDays <= horizonDays ? 1 : 0
  }
  return normalCdf((horizonDays - analysis.expectedDurationDays) / analysis.sigmaDays)
}

export type Rng = () => number

export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sampleTriangular(e: PertEstimate, rng: Rng): number {
  const o = e.optimisticDays
  const m = e.mostLikelyDays
  const p = e.pessimisticDays
  if (p === o) return o
  const u = rng()
  const f = (m - o) / (p - o)
  return u < f
    ? o + Math.sqrt(u * (p - o) * (m - o))
    : p - Math.sqrt((1 - u) * (p - o) * (p - m))
}

export type SimulationResult = {
  iterations: number
  p50Days: number
  p85Days: number
  p95Days: number
  probabilityWithinHorizon: number | null
}

export function simulateNetwork(
  nodes: NetworkNode[],
  opts: { iterations: number; horizonDays: number | null; rng?: Rng },
): SimulationResult {
  const rng = opts.rng ?? Math.random
  if (nodes.length === 0) {
    return {
      iterations: 0,
      p50Days: 0,
      p85Days: 0,
      p95Days: 0,
      probabilityWithinHorizon: opts.horizonDays === null ? null : 1,
    }
  }
  const byId = new Map(nodes.map(n => [n.id, n]))
  const order = topologicalOrder(nodes, byId)
  const durations: number[] = []
  for (let i = 0; i < opts.iterations; i++) {
    const finish = new Map<string, number>()
    let total = 0
    for (const id of order) {
      const n = byId.get(id)!
      const start = Math.max(0, ...n.dependsOn.filter(d => byId.has(d)).map(d => finish.get(d)!))
      const f = start + sampleTriangular(n.estimate, rng)
      finish.set(id, f)
      if (f > total) total = f
    }
    durations.push(total)
  }
  durations.sort((a, b) => a - b)
  const horizon = opts.horizonDays
  return {
    iterations: opts.iterations,
    p50Days: percentileSorted(durations, 50),
    p85Days: percentileSorted(durations, 85),
    p95Days: percentileSorted(durations, 95),
    probabilityWithinHorizon:
      horizon === null ? null : durations.filter(d => d <= horizon).length / durations.length,
  }
}

export function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]!
  const idx = ((sorted.length - 1) * p) / 100
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo)
}

export type CycleSample = {
  storyPoints: number | null
  cycleDays: number
}

export type EstimateSource = {
  kind: 'story_points_bucket' | 'board_global' | 'manual'
  sampleCount: number
}

export type ResolvedEstimate = {
  estimate: PertEstimate
  source: EstimateSource
}

export type EstimateCatalog = {
  totalSamples: number
  estimateFor(storyPoints: number | null): ResolvedEstimate | null
}

const MIN_BUCKET_SAMPLES = 5

export function buildEstimateCatalog(samples: CycleSample[]): EstimateCatalog {
  const globalSorted = samples.map(s => s.cycleDays).sort((a, b) => a - b)
  const byPoints = new Map<number, number[]>()
  for (const s of samples) {
    if (s.storyPoints === null) continue
    byPoints.set(s.storyPoints, [...(byPoints.get(s.storyPoints) ?? []), s.cycleDays])
  }
  for (const arr of byPoints.values()) arr.sort((a, b) => a - b)

  const toEstimate = (sorted: number[]): PertEstimate => ({
    optimisticDays: percentileSorted(sorted, 10),
    mostLikelyDays: percentileSorted(sorted, 50),
    pessimisticDays: percentileSorted(sorted, 90),
  })

  return {
    totalSamples: globalSorted.length,
    estimateFor(storyPoints: number | null): ResolvedEstimate | null {
      if (storyPoints !== null) {
        const bucket = byPoints.get(storyPoints)
        if (bucket && bucket.length >= MIN_BUCKET_SAMPLES) {
          return {
            estimate: toEstimate(bucket),
            source: { kind: 'story_points_bucket', sampleCount: bucket.length },
          }
        }
      }
      if (globalSorted.length >= MIN_BUCKET_SAMPLES) {
        return {
          estimate: toEstimate(globalSorted),
          source: { kind: 'board_global', sampleCount: globalSorted.length },
        }
      }
      return null
    },
  }
}
export type NetworkChange =
  | { type: 'exclude'; id: string }
  | { type: 'setEstimate'; id: string; estimate: PertEstimate }
  | { type: 'removeEdge'; blockerId: string; blockedId: string }
  | { type: 'addEdge'; blockerId: string; blockedId: string }

export function applyChangesToNetwork(nodes: NetworkNode[], changes: NetworkChange[]): NetworkNode[] {
  let result = nodes.map(n => ({ ...n, dependsOn: [...n.dependsOn] }))
  for (const c of changes) {
    if (c.type === 'exclude') {
      result = result.filter(n => n.id !== c.id)
      for (const n of result) n.dependsOn = n.dependsOn.filter(d => d !== c.id)
    }
    else if (c.type === 'setEstimate') {
      const node = result.find(n => n.id === c.id)
      if (node) node.estimate = c.estimate
    }
    else if (c.type === 'removeEdge') {
      const node = result.find(n => n.id === c.blockedId)
      if (node) node.dependsOn = node.dependsOn.filter(d => d !== c.blockerId)
    }
    else {
      const node = result.find(n => n.id === c.blockedId)
      const blockerExists = result.some(n => n.id === c.blockerId)
      if (node && blockerExists && !node.dependsOn.includes(c.blockerId)) {
        node.dependsOn.push(c.blockerId)
      }
    }
  }
  return result
}

export function scaleEstimateToM(base: PertEstimate, m: number): PertEstimate {
  if (base.mostLikelyDays <= 0) {
    return { optimisticDays: m, mostLikelyDays: m, pessimisticDays: m }
  }
  const k = m / base.mostLikelyDays
  return {
    optimisticDays: base.optimisticDays * k,
    mostLikelyDays: m,
    pessimisticDays: base.pessimisticDays * k,
  }
}

export function detectCycle(nodes: NetworkNode[]): boolean {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const state = new Map<string, 1 | 2>()
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true
    if (state.get(id) === 2) return false
    state.set(id, 1)
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(dep) && visit(dep)) return true
    }
    state.set(id, 2)
    return false
  }
  return nodes.some(n => visit(n.id))
}
