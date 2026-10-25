import type { ColumnRole } from '#shared/types/column'
import type { Role } from '#shared/types/domain'
import type { BoardPulse } from '#shared/types/pulse'
import type { Task } from '#shared/types/task'
import { pageRoutes } from '~/routing'
import { dueLocalDay } from './calendar'
import { hasRole } from './rbac'

export type NextAction = {
  id: string
  title: string
  reason: string
  icon: string
  tone: 'danger' | 'warning' | 'accent' | 'neutral'
  to: string | { path: string, query: Record<string, string> }
}

export type NextActionsInput = {
  now: Date
  workspaceId: string
  role: Role | undefined
  pulse: BoardPulse | null
  inboxUnread: number
  assigned: { id: string, taskId: string, boardId: string, taskTitle: string, authorName: string }[]
  myTasks: { task: Task, columnRole: ColumnRole | null }[]
}

const LIMIT = 3
const DAY = 86_400_000

type Scored = NextAction & { score: number }

function daysUntil(dueDate: string, now: Date): number {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.round((dueLocalDay(dueDate).getTime() - today.getTime()) / DAY)
}

export function nextActions(input: NextActionsInput): NextAction[] {
  const out: Scored[] = []
  const { workspaceId: ws, pulse: p } = input
  const canWork = hasRole(input.role, 'member')
  const leadsFlow = hasRole(input.role, 'scrum_master')
  const open = input.myTasks.filter(t => !t.task.closedAt)

  if (canWork) {
    const due = (t: { task: Task }) => (t.task.dueDate ? daysUntil(t.task.dueDate, input.now) : null)
    const overdue = open
      .filter(t => (due(t) ?? 0) < 0)
      .sort((a, b) => due(a)! - due(b)!)[0]
    if (overdue) {
      const late = -due(overdue)!
      out.push({
        id: `overdue:${overdue.task.id}`,
        score: 100,
        title: `Просрочена: «${overdue.task.title}»`,
        reason: `срок прошёл ${late} дн назад`,
        icon: 'i-hugeicons-alert-circle',
        tone: 'danger',
        to: pageRoutes.task(ws, overdue.task.boardId, overdue.task.id),
      })
    }

    const assignment = input.assigned[0]
    if (assignment) {
      out.push({
        id: `assigned:${assignment.id}`,
        score: 90,
        title: `Поручение: «${assignment.taskTitle}»`,
        reason: input.assigned.length > 1
          ? `от ${assignment.authorName}, всего открыто ${input.assigned.length}`
          : `от ${assignment.authorName}`,
        icon: 'i-hugeicons-message-user-01',
        tone: 'accent',
        to: pageRoutes.task(ws, assignment.boardId, assignment.taskId),
      })
    }

    const dueToday = open.find(t => due(t) === 0)
    if (dueToday) {
      out.push({
        id: `today:${dueToday.task.id}`,
        score: 55,
        title: `Срок сегодня: «${dueToday.task.title}»`,
        reason: 'закройте или перенесите срок осознанно',
        icon: 'i-hugeicons-calendar-03',
        tone: 'warning',
        to: pageRoutes.task(ws, dueToday.task.boardId, dueToday.task.id),
      })
    }

    const inProgress = open.find(t => t.columnRole === 'in_progress')
    if (inProgress) {
      out.push({
        id: `continue:${inProgress.task.id}`,
        score: 20,
        title: `Продолжить: «${inProgress.task.title}»`,
        reason: 'в работе у вас',
        icon: 'i-hugeicons-play',
        tone: 'neutral',
        to: pageRoutes.task(ws, inProgress.task.boardId, inProgress.task.id),
      })
    }
  }

  if (input.inboxUnread > 0) {
    out.push({
      id: 'inbox',
      score: 80,
      title: `Входящие: ${input.inboxUnread} новых`,
      reason: 'упоминания, ответы и назначения ждут вас',
      icon: 'i-hugeicons-inbox',
      tone: 'accent',
      to: pageRoutes.workspaceInbox(ws),
    })
  }

  if (leadsFlow && p) {
    const board = pageRoutes.board(ws, p.board.id)
    const over = p.wip.filter(c => c.limit !== null && c.count > c.limit).sort((a, b) => (b.count - b.limit!) - (a.count - a.limit!))[0]
    if (over) {
      out.push({
        id: `wip:${over.columnId}`,
        score: 85,
        title: `WIP превышен в «${over.name}»`,
        reason: `${over.count} из ${over.limit}: сначала доделать, потом брать новое`,
        icon: 'i-hugeicons-layers-01',
        tone: 'danger',
        to: board,
      })
    }

    if (p.blockers.count > 0 && (p.blockers.longestDays ?? 0) >= 2) {
      out.push({
        id: 'blockers',
        score: 75,
        title: `Блокер держится ${p.blockers.longestDays} дн`,
        reason: `заблокировано задач на доске: ${p.blockers.count}`,
        icon: 'i-hugeicons-octagon-x',
        tone: 'warning',
        to: board,
      })
    }

    const { lastAt, periodDays } = p.board.replenishment
    const late = lastAt ? Math.floor((input.now.getTime() - new Date(lastAt).getTime()) / DAY) - periodDays : null
    if (late !== null && late > 0) {
      out.push({
        id: 'replenish',
        score: 70,
        title: 'Пора пополнить бэклог',
        reason: `просрочка ${late} дн при периоде ${periodDays} дн`,
        icon: 'i-hugeicons-refresh',
        tone: 'warning',
        to: board,
      })
    }

    if (p.sprint && p.sprint.daysLeft <= 1) {
      out.push({
        id: 'sprint-end',
        score: 65,
        title: `«${p.sprint.name}» заканчивается ${p.sprint.daysLeft <= 0 ? 'сегодня' : 'завтра'}`,
        reason: 'подготовьте ретро и закрытие спринта',
        icon: 'i-hugeicons-flag-02',
        tone: 'accent',
        to: pageRoutes.boardSprints(ws, p.board.id),
      })
    }

    if (p.sprint?.probability != null && p.sprint.probability < 50) {
      out.push({
        id: 'sprint-risk',
        score: 60,
        title: `Шанс закрыть спринт в срок ${p.sprint.probability}%`,
        reason: 'объём не помещается: пересмотрите состав спринта',
        icon: 'i-hugeicons-chart-down',
        tone: 'warning',
        to: pageRoutes.boardSprints(ws, p.board.id),
      })
    }
  }

  if (canWork && !leadsFlow && p && p.aging.count > 0 && p.aging.p85Days) {
    out.push({
      id: 'aging',
      score: 40,
      title: `Стареют задач: ${p.aging.count}`,
      reason: `дольше типичных ${p.aging.p85Days} дн (P85) на доске`,
      icon: 'i-hugeicons-hourglass',
      tone: 'neutral',
      to: pageRoutes.board(ws, p.board.id),
    })
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMIT)
    .map(({ score: _score, ...action }) => action)
}
