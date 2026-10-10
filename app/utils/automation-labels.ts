import type { AutomationAction, AutomationTrigger, NotifyRecipients, RuleInput } from '#shared/types/automation'

type Params = Record<string, unknown>

export type TriggerInfo = {
  label: string
  hint: string
  icon: string
  sentence: (p: Params) => string
}

export const TRIGGER_INFO: Record<AutomationTrigger, TriggerInfo> = {
  task_aging: {
    label: 'Задача стареет',
    hint: 'Задача в рабочей колонке дольше заданной доли SLE доски',
    icon: 'i-lucide-alert-triangle',
    sentence: p => `задача в колонке дольше ${p.thresholdPct ?? 85}% SLE`,
  },
  task_blocked: {
    label: 'Задача в блоке',
    hint: 'Флаг блокера держится дольше N дней',
    icon: 'i-lucide-octagon',
    sentence: p => `задача в блоке дольше ${p.days ?? 2} дн`,
  },
  sprint_forecast: {
    label: 'Прогноз спринта падает',
    hint: 'Шанс закрыть активный спринт в срок (Монте-Карло) ниже порога',
    icon: 'i-lucide-trending-down',
    sentence: p => `шанс закрыть спринт ниже ${p.minProbability ?? 70}%`,
  },
  wip_exceeded: {
    label: 'WIP превышен',
    hint: 'В рабочей колонке больше задач, чем её WIP-лимит',
    icon: 'i-lucide-layers',
    sentence: () => 'колонка над WIP-лимитом',
  },
  replenishment_overdue: {
    label: 'Пополнение просрочено',
    hint: 'Бэклог не пополняли дольше периода доски',
    icon: 'i-lucide-refresh-cw',
    sentence: () => 'пополнение бэклога просрочено',
  },
}

export const ACTION_INFO: Record<AutomationAction, { label: string; hint: string; sentence: (p: Params) => string }> = {
  notify: {
    label: 'Уведомить',
    hint: 'Уведомление в приложении выбранным получателям',
    sentence: p => `уведомить ${RECIPIENT_LABEL[(p.recipients as NotifyRecipients) ?? 'scrum_masters']}`,
  },
  comment: {
    label: 'Комментарий в задаче',
    hint: 'Системный комментарий с цифрами прямо в задаче',
    sentence: () => 'оставить комментарий в задаче',
  },
  daily_agenda: {
    label: 'В повестку daily',
    hint: 'Попадает в секцию «Требует внимания» ежедневного дайджеста',
    sentence: () => 'добавить в повестку daily',
  },
}

export const RECIPIENT_LABEL: Record<NotifyRecipients, string> = {
  assignee: 'исполнителя',
  scrum_masters: 'скрам-мастеров',
  all_members: 'всех участников',
}

export const TRIGGER_PARAM_FIELDS: Record<AutomationTrigger, { key: string; label: string; min: number; max: number; suffix: string }[]> = {
  task_aging: [{ key: 'thresholdPct', label: 'Порог', min: 50, max: 200, suffix: '% SLE' }],
  task_blocked: [{ key: 'days', label: 'Дней в блоке', min: 1, max: 30, suffix: 'дн' }],
  sprint_forecast: [{ key: 'minProbability', label: 'Минимальный шанс', min: 10, max: 95, suffix: '%' }],
  wip_exceeded: [],
  replenishment_overdue: [],
}

export const RECOMMENDED_RULES: { title: string; why: string; input: RuleInput }[] = [
  {
    title: 'Задача застряла',
    why: 'Исполнитель узнаёт первым, что задача висит дольше 85% SLE доски',
    input: { trigger: 'task_aging', triggerParams: { thresholdPct: 85 }, action: 'notify', actionParams: { recipients: 'assignee' } },
  },
  {
    title: 'Прогноз спринта упал',
    why: 'Скрам-мастера видят, когда шанс закрыть спринт в срок опускается ниже 70%',
    input: { trigger: 'sprint_forecast', triggerParams: { minProbability: 70 }, action: 'notify', actionParams: { recipients: 'scrum_masters' } },
  },
  {
    title: 'Пора пополнить бэклог',
    why: 'Напоминание скрам-мастерам, когда период пополнения доски прошёл',
    input: { trigger: 'replenishment_overdue', triggerParams: {}, action: 'notify', actionParams: { recipients: 'scrum_masters' } },
  },
]
