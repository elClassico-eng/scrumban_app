import type { Role, SprintState, TaskEventType } from '#shared/types/domain'

export function humanizeRole(role: Role): string {
  const map: Record<Role, string> = {
    viewer: 'Наблюдатель',
    member: 'Участник',
    scrum_master: 'Скрам-мастер',
    admin: 'Администратор',
    owner: 'Владелец',
  }
  return map[role]
}

export function humanizeSprintState(state: SprintState): string {
  const map: Record<SprintState, string> = {
    planned: 'Запланирован',
    active: 'Активен',
    closed: 'Закрыт',
  }
  return map[state]
}

export function humanizeTaskEventType(type: TaskEventType): string {
  const map: Record<TaskEventType, string> = {
    task_created: 'Создана',
    task_moved: 'Перемещена',
    task_closed: 'Закрыта',
    task_reopened: 'Переоткрыта',
    task_assigned: 'Назначена',
    task_updated: 'Обновлена',
    task_archived: 'Архивирована',
    task_commented: 'Прокомментирована',
    task_comment_deleted: 'Удалён комментарий',
  }
  return map[type]
}