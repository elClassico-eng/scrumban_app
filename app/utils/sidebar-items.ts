import type { SidebarItemId } from '#shared/types/sidebar'

export const SIDEBAR_ITEM_META: Record<SidebarItemId, { label: string, icon: string }> = {
  inbox: { label: 'Входящие', icon: 'i-hugeicons-inbox' },
  my_tasks: { label: 'Мои задачи', icon: 'i-hugeicons-task-done-01' },
  overview: { label: 'Обзор', icon: 'i-hugeicons-home-01' },
  activity: { label: 'Активность', icon: 'i-hugeicons-activity-01' },
  reports: { label: 'Отчёты', icon: 'i-hugeicons-clipboard-list' },
  simulator: { label: 'Симулятор', icon: 'i-hugeicons-flask-conical' },
  favorites: { label: 'Избранное', icon: 'i-hugeicons-star' },
  whats_new: { label: 'Что нового', icon: 'i-hugeicons-sparkles' },
  help: { label: 'Справка', icon: 'i-hugeicons-help-circle' },
  docs: { label: 'Документация', icon: 'i-hugeicons-book-open-01' },
}

export const SIDEBAR_SPRING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } as const
