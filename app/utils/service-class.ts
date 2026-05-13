import type { ServiceClass } from '#shared/types/domain'

interface ServiceClassInfo {
  label: string
  shortLabel: string
  hint: string
  // Solid colour for the small leading dot rendered on TaskCard — replaces
  // the older full chip to keep cards scannable. Same hue family as the CoS
  // semantic colour used elsewhere (expedite=red, fixed_date=amber, ...).
  dotClass: string
}

export const SERVICE_CLASS_INFO: Record<ServiceClass, ServiceClassInfo> = {
  standard: {
    label: 'Стандарт — обычный поток',
    shortLabel: 'Стандарт',
    hint: 'Базовая очередь. Берётся в работу по FIFO, без приоритета.',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
  },
  expedite: {
    label: 'Срочно — обходит WIP',
    shortLabel: 'Срочно',
    hint: 'Критическая задача (инцидент, авария): пропускает WIP-лимит и поднимается наверх. На доске одновременно желательно держать максимум одну такую.',
    dotClass: 'bg-red-500',
  },
  fixed_date: {
    label: 'С дедлайном — жёсткий срок',
    shortLabel: 'С дедлайном',
    hint: 'Задача с обязательной датой завершения. Берётся в работу так, чтобы успеть до дедлайна с запасом.',
    dotClass: 'bg-amber-500',
  },
  intangible: {
    label: 'Фоновая — когда есть время',
    shortLabel: 'Фоновая',
    hint: 'Техдолг, документация, улучшения. Берётся, когда нет более срочной работы.',
    dotClass: 'bg-zinc-400 dark:bg-zinc-500',
  },
}

export const SERVICE_CLASS_OPTIONS: Array<{ label: string; value: ServiceClass }> = (
  Object.entries(SERVICE_CLASS_INFO) as Array<[ServiceClass, ServiceClassInfo]>
).map(([value, info]) => ({ label: info.label, value }))