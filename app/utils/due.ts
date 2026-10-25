import { dueDayInfo, dueLocalDay } from './calendar'

export type DueTone = 'overdue' | 'today' | 'soon' | 'normal'

export type DueInfo = {
  diff: number
  tone: DueTone
  dateLabel: string
}

export function dueInfo(dueDate: string | null): DueInfo | null {
  if (!dueDate) return null
  const { diff, tone } = dueDayInfo(dueDate)
  const dateLabel = dueLocalDay(dueDate).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
  return { diff, tone, dateLabel }
}
