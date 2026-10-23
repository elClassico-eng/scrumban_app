export const SHORTCUT_IDS = ['go_inbox', 'go_my_tasks', 'go_overview', 'go_boards', 'new_task', 'toggle_sidebar'] as const

export type ShortcutId = (typeof SHORTCUT_IDS)[number]

export type ShortcutPrefs = Partial<Record<ShortcutId, string>>
