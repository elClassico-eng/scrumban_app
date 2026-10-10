import type {
  CalibrationReliability,
  ForecastSnapshotPayload,
  SprintOutcome,
  SprintOutcomeResult,
} from '../types/forecast'

const DAY_MS = 86_400_000

export function resolveOutcome(input: {
  startedAt: Date | null
  start: ForecastSnapshotPayload | null
  close: ForecastSnapshotPayload | null
}): SprintOutcomeResult {
  const unknown: SprintOutcomeResult = { outcome: 'unknown', actualDays: null, p50Hit: null, p85Hit: null }
  const res = input.close?.resolution
  if (!input.startedAt || !input.start || !res || res.carriedCount === undefined) return unknown
  if (res.totalCount === 0) return unknown
  if (res.carriedCount > 0) return { outcome: 'carryover', actualDays: null, p50Hit: false, p85Hit: false }
  if (!res.lastDoneAt) return unknown

  const actualDays = Math.round(((new Date(res.lastDoneAt).getTime() - input.startedAt.getTime()) / DAY_MS) * 10) / 10
  const p50Hit = actualDays <= input.start.simulation.p50Days
  const p85Hit = actualDays <= input.start.simulation.p85Days
  const outcome: SprintOutcome = p85Hit ? 'hit' : 'miss'
  return { outcome, actualDays, p50Hit, p85Hit }
}

export function reliabilityFor(scored: number): CalibrationReliability {
  if (scored >= 10) return 'ok'
  if (scored >= 5) return 'low'
  return 'insufficient'
}
