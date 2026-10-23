export const SIDEBAR_ITEM_IDS = ['inbox', 'my_tasks', 'overview', 'activity', 'reports', 'simulator', 'favorites', 'whats_new', 'help', 'docs'] as const

export type SidebarItemId = (typeof SIDEBAR_ITEM_IDS)[number]

export const SIDEBAR_FRAMES = ['dark', 'light'] as const

export type SidebarFrame = (typeof SIDEBAR_FRAMES)[number]

export type SidebarPrefs = {
  hidden?: SidebarItemId[]
  favorites?: string[]
  boardOrder?: string[]
  frame?: SidebarFrame
}
