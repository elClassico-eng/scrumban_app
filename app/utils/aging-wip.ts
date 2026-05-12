// Aging-WIP signal: how a task's age compares to the board's SLE.
// Returns Tailwind classes to tint the card border, mirroring the
// Anderson Kanban convention (50/70/85 percentile checkpoints).
//
// Anchor for "age" in this MVP is task.createdAt. The strictly-correct
// anchor is "moved into current column at" — Phase 8 will refine when
// the alerts endpoint adds per-column percentile thresholds.

export type AgingLevel = 'fresh' | 'warn50' | 'warn70' | 'over85'

export interface AgingTier {
  level: AgingLevel
  cardClass: string
}

const TIERS: Record<AgingLevel, string> = {
  fresh: '',
  warn50: 'ring-1 ring-warning/30',
  warn70: 'ring-1 ring-warning border-warning/60',
  over85: 'ring-1 ring-error border-error/70',
}

export function getAgingTier(ageDays: number, sleDays: number | null): AgingTier {
  if (!sleDays || sleDays <= 0) return { level: 'fresh', cardClass: TIERS.fresh }
  const ratio = ageDays / sleDays
  if (ratio >= 0.85) return { level: 'over85', cardClass: TIERS.over85 }
  if (ratio >= 0.70) return { level: 'warn70', cardClass: TIERS.warn70 }
  if (ratio >= 0.50) return { level: 'warn50', cardClass: TIERS.warn50 }
  return { level: 'fresh', cardClass: TIERS.fresh }
}

export function ageDaysFromIso(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}