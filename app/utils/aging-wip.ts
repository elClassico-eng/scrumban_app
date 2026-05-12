// Aging-WIP signal: how a task's age compares to the board's SLE.
// Returns a chip render config — small clock badge in the card corner,
// mirroring the Anderson Kanban convention (50/70/85 percentile checkpoints).
//
// Anchor for "age" in this MVP is task.createdAt. The strictly-correct
// anchor is "moved into current column at" — Phase 8 will refine when
// the alerts endpoint adds per-column percentile thresholds.

export type AgingLevel = 'fresh' | 'warn50' | 'warn70' | 'over85'

export interface AgingTier {
  level: AgingLevel
  show: boolean
  chipClass: string
}

const TIERS: Record<AgingLevel, { show: boolean; chipClass: string }> = {
  fresh: { show: false, chipClass: '' },
  warn50: {
    show: true,
    chipClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  warn70: {
    show: true,
    chipClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  over85: {
    show: true,
    chipClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
}

export function getAgingTier(ageDays: number, sleDays: number | null): AgingTier {
  if (!sleDays || sleDays <= 0) return { level: 'fresh', ...TIERS.fresh }
  const ratio = ageDays / sleDays
  if (ratio >= 0.85) return { level: 'over85', ...TIERS.over85 }
  if (ratio >= 0.70) return { level: 'warn70', ...TIERS.warn70 }
  if (ratio >= 0.50) return { level: 'warn50', ...TIERS.warn50 }
  return { level: 'fresh', ...TIERS.fresh }
}

export function ageDaysFromIso(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}