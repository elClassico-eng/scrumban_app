import type { Role, SprintState, TaskEventType } from '#shared/types/domain'

export function humanizeRole(role: Role): string {
  return ROLE_LABEL[role]
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
    task_added_to_sprint: 'Добавлена в спринт',
    task_removed_from_sprint: 'Убрана из спринта',
    task_blocked: 'Заблокирована',
    task_unblocked: 'Разблокирована',
  }
  return map[type]
}