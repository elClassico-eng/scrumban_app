export const BOARD_EMOJIS = [
  '🚀', '📦', '🎨', '🐛', '🔥', '⚡', '🎯', '💡',
  '📈', '📊', '🧪', '🛠️', '⚙️', '🔒', '🌐', '📱',
  '💻', '🖥️', '🗄️', '☁️', '🤖', '🧩', '📚', '🎓',
  '📣', '💬', '✉️', '📅', '⏱️', '💼', '💰', '🛒',
  '❤️', '⭐', '🌱', '🏠', '🎬', '🎵', '🏁', '🧭',
] as const

export const BOARD_ICON_NAMES = [
  'i-hugeicons-rocket-01', 'i-hugeicons-code', 'i-hugeicons-bug-01', 'i-hugeicons-paint-board',
  'i-hugeicons-package', 'i-hugeicons-target-02', 'i-hugeicons-flag-02', 'i-hugeicons-star',
  'i-hugeicons-idea-01', 'i-hugeicons-chart-line-data-01', 'i-hugeicons-analytics-01', 'i-hugeicons-database',
  'i-hugeicons-server-stack-01', 'i-hugeicons-cloud', 'i-hugeicons-shield-01', 'i-hugeicons-lock-key',
  'i-hugeicons-user-group', 'i-hugeicons-megaphone-01', 'i-hugeicons-mail-01', 'i-hugeicons-message-01',
  'i-hugeicons-calendar-03', 'i-hugeicons-clock-01', 'i-hugeicons-briefcase-01', 'i-hugeicons-book-open-01',
  'i-hugeicons-test-tube-01', 'i-hugeicons-settings-02', 'i-hugeicons-wrench-01', 'i-hugeicons-puzzle',
  'i-hugeicons-globe', 'i-hugeicons-smart-phone-01', 'i-hugeicons-laptop', 'i-hugeicons-image-01',
  'i-hugeicons-shopping-cart-01', 'i-hugeicons-money-bag-02', 'i-hugeicons-heart', 'i-hugeicons-fire',
  'i-hugeicons-leaf-01', 'i-hugeicons-git-branch', 'i-hugeicons-terminal', 'i-hugeicons-sparkles',
] as const

export const BOARD_ICONS = [...BOARD_EMOJIS, ...BOARD_ICON_NAMES] as const

export type BoardIcon = (typeof BOARD_ICONS)[number]

export function isIconName(icon: string): boolean {
  return icon.startsWith('i-')
}
