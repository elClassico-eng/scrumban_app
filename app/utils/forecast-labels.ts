import type { CalibrationReliability, ForecastTrigger, SprintOutcome } from '#shared/types/forecast'

export const OUTCOME_LABEL: Record<SprintOutcome, string> = {
  hit: 'попадание',
  miss: 'промах',
  carryover: 'перенос',
  unknown: 'нет данных',
}

export const OUTCOME_CLASS: Record<SprintOutcome, string> = {
  hit: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  miss: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300',
  carryover: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  unknown: 'bg-elevated text-muted',
}

export const TRIGGER_LABEL: Record<ForecastTrigger, string> = {
  sprint_start: 'старт',
  daily: 'ежедневный',
  sprint_close: 'закрытие',
}

export const RELIABILITY_TEXT: Record<CalibrationReliability, string> = {
  insufficient: 'мало данных для выводов',
  low: 'выборка небольшая, относись к процентам осторожно',
  ok: 'выборка достаточная',
}

export function pct(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}
