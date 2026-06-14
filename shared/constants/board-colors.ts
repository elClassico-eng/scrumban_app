export const BOARD_COLORS = [
  '#e85002',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#64748b',
] as const

export const DEFAULT_BOARD_COLOR = '#e85002'

export const BOARD_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function boardColorForIndex(index: number): string {
  return BOARD_COLORS[index % BOARD_COLORS.length] ?? DEFAULT_BOARD_COLOR
}