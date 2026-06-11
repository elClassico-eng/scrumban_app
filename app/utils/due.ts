export type DueTone = 'overdue' | 'today' | 'soon' | 'normal'

export type DueInfo = {
  diff: number
  tone: DueTone
  dateLabel: string
}

export function dueInfo(dueDate: string | null): DueInfo | null {
  if (!dueDate) return null
  const d = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(d)
  dueDay.setHours(0, 0, 0, 0)
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
  const dateLabel = d.toLocaleDateString('ru', { day: '2-digit', month: 'short' })
  let tone: DueTone = 'normal'
  if (diff < 0) tone = 'overdue'
  else if (diff === 0) tone = 'today'
  else if (diff <= 3) tone = 'soon'
  return { diff, tone, dateLabel }
}
