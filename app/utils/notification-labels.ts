import type { InstantNotificationType } from '#shared/types/notification'

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  mention: 'Упоминания в комментариях',
  assigned: 'Назначение на задачу',
  comment_on_assigned: 'Комментарии к моим задачам',
  sle_breach: 'Нарушение SLE',
  replenishment_overdue: 'Просроченное пополнение',
  sprint_forecast_drop: 'Падение прогноза спринта',
  automation: 'Автоматизации доски',
  watched_comment: 'Комментарии в задачах, за которыми слежу',
  watched_status: 'Смена статуса задач, за которыми слежу',
  integration_failed: 'Сбои интеграций',
}

export const INSTANT_NOTIFICATION_LABEL: Record<InstantNotificationType, string> = {
  mention: 'Меня упомянули',
  reply: 'Ответили в моей ветке',
  comment_assigned: 'Мне дали поручение в комментарии',
  assigned: 'Меня назначили на задачу',
}
