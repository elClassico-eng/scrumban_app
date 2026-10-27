import type { ColumnRole } from '../types/column'

export const FLOW_STAGE: Record<ColumnRole, number> = {
  backlog: 0,
  in_progress: 1,
  review: 1,
  done: 2,
  archived: 3,
}

export function isFlowOrdered(roles: ColumnRole[]): boolean {
  return roles.every((role, i) => i === 0 || FLOW_STAGE[role] >= FLOW_STAGE[roles[i - 1]!])
}
