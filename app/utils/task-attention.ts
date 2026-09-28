import type { Task } from '#shared/types/task'
import { dueDayInfo } from './calendar'
import { plural } from './plural'

export type AttentionKind = 'overdue' | 'blocked' | 'due_soon'

export type AttentionItem = {
  id: string
  boardId: string
  title: string
  kind: AttentionKind
  // Split so only the number carries colour: a column of fully red rows stops
  // reading as urgent.
  stateLabel: string
  stateValue: string
  reason: string | null
  assigneeIds: string[]
  severity: number
}

const DAYS = ['день', 'дня', 'дней'] as [string, string, string]

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const started = new Date(iso)
  started.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - started.getTime()) / 86_400_000))
}

export function attentionFor(task: Task): AttentionItem | null {
  if (task.closedAt) return null

  const due = task.dueDate ? dueDayInfo(task.dueDate) : null
  const base = {
    id: task.id,
    boardId: task.boardId,
    title: task.title,
    assigneeIds: task.assigneeIds.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [],
  }

  if (due && due.diff < 0) {
    const late = Math.abs(due.diff)
    return {
      ...base,
      kind: 'overdue',
      stateLabel: 'просрочено на',
      stateValue: `${late} ${plural(late, DAYS)}`,
      reason: task.blockedReason,
      severity: 1000 + late,
    }
  }

  if (task.blockedReason !== null) {
    const stuck = daysSince(task.blockedSince)
    return {
      ...base,
      kind: 'blocked',
      stateLabel: stuck === null ? '' : 'в блоке',
      stateValue: stuck === null ? 'заблокировано' : `${stuck} ${plural(stuck, DAYS)}`,
      reason: task.blockedReason || null,
      severity: 500 + (stuck ?? 0),
    }
  }

  if (due && due.diff <= 3) {
    return {
      ...base,
      kind: 'due_soon',
      stateLabel: 'срок',
      stateValue: due.diff === 0 ? 'сегодня' : `через ${due.diff} ${plural(due.diff, DAYS)}`,
      reason: null,
      severity: 100 - due.diff,
    }
  }

  return null
}

export function buildAttention(tasks: Task[]): AttentionItem[] {
  return tasks
    .map(attentionFor)
    .filter((i): i is AttentionItem => i !== null)
    .sort((a, b) => b.severity - a.severity)
}

export const ATTENTION_TONE: Record<AttentionKind, { icon: string, text: string, bg: string }> = {
  overdue: { icon: 'i-lucide-calendar-x', text: 'text-error-600', bg: 'bg-error-50 dark:bg-error-950/40' },
  blocked: { icon: 'i-lucide-octagon-alert', text: 'text-error-600', bg: 'bg-error-50 dark:bg-error-950/40' },
  due_soon: { icon: 'i-lucide-calendar-clock', text: 'text-accent-600', bg: 'bg-accent-50 dark:bg-accent-950/40' },
}
