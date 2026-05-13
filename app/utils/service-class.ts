import type { ServiceClass } from '#shared/types/domain'

interface ServiceClassInfo {
  label: string
  shortLabel: string
  hint: string
}

export const SERVICE_CLASS_INFO: Record<ServiceClass, ServiceClassInfo> = {
  standard: {
    label: 'Стандарт — обычный поток',
    shortLabel: 'Стандарт',
    hint: 'Базовая очередь. Берётся в работу по FIFO, без приоритета.',
  },
  expedite: {
    label: 'Срочно — обходит WIP',
    shortLabel: 'Срочно',
    hint: 'Критическая задача (инцидент, авария): пропускает WIP-лимит и поднимается наверх. На доске одновременно желательно держать максимум одну такую.',
  },
  fixed_date: {
    label: 'С дедлайном — жёсткий срок',
    shortLabel: 'С дедлайном',
    hint: 'Задача с обязательной датой завершения. Берётся в работу так, чтобы успеть до дедлайна с запасом.',
  },
  intangible: {
    label: 'Фоновая — когда есть время',
    shortLabel: 'Фоновая',
    hint: 'Техдолг, документация, улучшения. Берётся, когда нет более срочной работы.',
  },
}

export const SERVICE_CLASS_OPTIONS: Array<{ label: string; value: ServiceClass }> = (
  Object.entries(SERVICE_CLASS_INFO) as Array<[ServiceClass, ServiceClassInfo]>
).map(([value, info]) => ({ label: info.label, value }))