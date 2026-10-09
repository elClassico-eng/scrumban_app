import type { Notification } from '#shared/types/notification'
import { pageRoutes } from '~/routing'

export type RouteTarget = string | { path: string; query: Record<string, string> }

export type RenderedNotification = {
  title: string
  why: string
  cta: string
  target: RouteTarget | null
  icon: string
  color: string
}

const ACCENT = '#e85002'
const PURPLE = '#7a4cf0'
const BLUE = '#2e6df5'

type P = Record<string, string | number | undefined>

function actorOf(p: P): string {
  return String(p.actorName ?? p.actorEmail ?? 'Кто-то')
}

function taskTarget(n: Notification, p: P): RouteTarget | null {
  return p.taskId && p.boardId ? pageRoutes.task(n.workspaceId, String(p.boardId), String(p.taskId)) : null
}

function boardTarget(n: Notification, p: P): RouteTarget | null {
  return p.boardId ? pageRoutes.board(n.workspaceId, String(p.boardId)) : null
}

function sprintsTarget(n: Notification, p: P): RouteTarget | null {
  return p.boardId ? pageRoutes.boardSprints(n.workspaceId, String(p.boardId)) : null
}

function renderAutomation(n: Notification, p: P): RenderedNotification {
  switch (p.trigger) {
    case 'task_aging':
      return {
        title: 'Задача застряла',
        why: `«${p.taskTitle}» в колонке ${p.columnName} уже ${p.ageDays} дн – это ${p.pct}% от SLE доски (${p.sleDays} дн)`,
        cta: 'Открыть задачу',
        target: taskTarget(n, p),
        icon: 'i-lucide-alert-triangle',
        color: ACCENT,
      }
    case 'task_blocked':
      return {
        title: `Блок держится ${p.days} дн`,
        why: `«${p.taskTitle}»: ${p.reason}`,
        cta: 'Открыть задачу',
        target: taskTarget(n, p),
        icon: 'i-lucide-octagon',
        color: ACCENT,
      }
    case 'sprint_forecast':
      return {
        title: 'Прогноз спринта упал',
        why: `${p.sprintName}: шанс закрыть в срок ${p.probability}%, осталось ${p.tasksRemaining} задач на ${p.daysLeft} дн`,
        cta: 'Открыть спринты',
        target: sprintsTarget(n, p),
        icon: 'i-lucide-trending-down',
        color: ACCENT,
      }
    case 'wip_exceeded':
      return {
        title: 'WIP превышен',
        why: `${p.columnName}: ${p.count} задач при лимите ${p.limit}`,
        cta: 'Открыть доску',
        target: boardTarget(n, p),
        icon: 'i-lucide-layers',
        color: ACCENT,
      }
    case 'replenishment_overdue':
      return {
        title: 'Пора пополнить бэклог',
        why: `${p.boardName}: просрочка ${p.daysOverdue} дн`,
        cta: 'Открыть доску',
        target: boardTarget(n, p),
        icon: 'i-lucide-refresh-cw',
        color: ACCENT,
      }
    default:
      return {
        title: 'Сработало правило',
        why: '',
        cta: 'Открыть доску',
        target: boardTarget(n, p),
        icon: 'i-lucide-zap',
        color: ACCENT,
      }
  }
}

export function renderNotification(n: Notification): RenderedNotification {
  const p = n.payload as P
  switch (n.type) {
    case 'mention':
      return {
        title: 'Упомянули в комментарии',
        why: `${actorOf(p)} · «${p.taskTitle ?? ''}»`,
        cta: 'Открыть задачу',
        target: taskTarget(n, p),
        icon: 'i-lucide-at-sign',
        color: PURPLE,
      }
    case 'assigned':
      return {
        title: 'Назначили задачу',
        why: `${actorOf(p)} · «${p.taskTitle ?? ''}»`,
        cta: 'Открыть задачу',
        target: taskTarget(n, p),
        icon: 'i-lucide-user-check',
        color: BLUE,
      }
    case 'comment_on_assigned':
      return {
        title: 'Прокомментировали вашу задачу',
        why: `${actorOf(p)} · «${p.taskTitle ?? ''}»`,
        cta: 'Открыть задачу',
        target: taskTarget(n, p),
        icon: 'i-lucide-message-square',
        color: PURPLE,
      }
    case 'sle_breach':
      return {
        title: 'Задача застряла дольше SLE',
        why: `«${p.taskTitle ?? ''}»: возраст ${p.agePct}% от SLE`,
        cta: 'Открыть задачу',
        target: taskTarget(n, p),
        icon: 'i-lucide-alert-triangle',
        color: ACCENT,
      }
    case 'replenishment_overdue':
      return {
        title: 'Пора провести Replenishment',
        why: `${p.boardName ?? ''}: просрочка ${p.daysOverdue} дн`,
        cta: 'Открыть доску',
        target: boardTarget(n, p),
        icon: 'i-lucide-refresh-cw',
        color: ACCENT,
      }
    case 'sprint_forecast_drop':
      return {
        title: 'Прогноз спринта упал',
        why: `${p.sprintName ?? ''}: шанс ${Math.round(Number(p.probability ?? 0) * 100)}%`,
        cta: 'Открыть спринты',
        target: sprintsTarget(n, p),
        icon: 'i-lucide-trending-down',
        color: ACCENT,
      }
    case 'automation':
      return renderAutomation(n, p)
  }
}
