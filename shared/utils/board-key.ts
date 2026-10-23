export const BOARD_KEY_RE = /^[A-ZА-ЯЁ][A-ZА-ЯЁ0-9]{1,5}$/

export function deriveBoardKey(name: string): string {
  return name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() || 'BRD'
}

export function formatTaskKey(boardKey: string | undefined, number: number): string {
  return boardKey ? `${boardKey}-${number}` : `#${number}`
}
