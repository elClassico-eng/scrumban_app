import type { ServiceClass } from '#shared/types/domain'

interface ServiceClassInfo {
  label: string
  shortLabel: string
  hint: string
}

export const SERVICE_CLASS_INFO: Record<ServiceClass, ServiceClassInfo> = {
  standard: {
    label: 'Standard — обычный поток',
    shortLabel: 'Standard',
    hint: 'Базовая очередь. Берётся в работу по FIFO, без приоритета.',
  },
  expedite: {
    label: 'Expedite — срочно, обходит WIP',
    shortLabel: 'Expedite',
    hint: 'Критическая задача: пропускает WIP-лимит и поднимается наверх. Используй для инцидентов.',
  },
  fixed_date: {
    label: 'Fixed Date — есть дедлайн',
    shortLabel: 'Fixed Date',
    hint: 'Задача с обязательной датой. Берётся в работу так, чтобы успеть до дедлайна.',
  },
  intangible: {
    label: 'Intangible — когда есть время',
    shortLabel: 'Intangible',
    hint: 'Техдолг и улучшения. Берётся, когда нет более срочной работы.',
  },
}

export const SERVICE_CLASS_OPTIONS: Array<{ label: string; value: ServiceClass }> = (
  Object.entries(SERVICE_CLASS_INFO) as Array<[ServiceClass, ServiceClassInfo]>
).map(([value, info]) => ({ label: info.label, value }))