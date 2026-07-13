import type { SprintState } from '#shared/types/domain'

export const SPRINT_STATE_LABEL: Record<SprintState, string> = {
  planned: 'Запланирован',
  active: 'Активный',
  closed: 'Закрыт',
}

export const SPRINT_STATE_BADGE: Record<SprintState, string> = {
  planned: 'bg-elevated text-default',
  active: 'bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300',
  closed: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
}

export const SPRINT_STATE_DOT: Record<SprintState, string> = {
  planned: 'bg-zinc-400',
  active: 'bg-accent-500',
  closed: 'bg-emerald-500',
}
