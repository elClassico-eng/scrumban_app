import type { InstantEmailType } from '#shared/types/notification'

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
}

export const INSTANT_EMAIL_LABEL: Record<InstantEmailType, string> = {
  mention: 'Меня упомянули',
  reply: 'Ответили в моей ветке',
  comment_assigned: 'Мне дали поручение в комментарии',
  assigned: 'Меня назначили на задачу',
}
