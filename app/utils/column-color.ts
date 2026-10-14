import type { ColumnRole } from '#shared/types/column'

export const ROLE_HEX: Record<ColumnRole, string> = {
  backlog: '#94a3b8',
  in_progress: '#f59e0b',
  review: '#8b5cf6',
  done: '#10b981',
  archived: '#a1a1aa',
}

export function columnHex(column: { color: string | null; columnRole: ColumnRole }): string {
  return column.color ?? ROLE_HEX[column.columnRole]
}
