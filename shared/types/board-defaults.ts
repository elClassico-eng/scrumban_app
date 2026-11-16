export const SLE_PROBABILITIES = [0.5, 0.7, 0.85, 0.95] as const

export type BoardDefaults = {
  sleProbability?: (typeof SLE_PROBABILITIES)[number]
  replenishmentPeriodDays?: number
  columnTint?: boolean
}
