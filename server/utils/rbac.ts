// Role hierarchy and permission helpers used by workspace-scoped endpoints.
// Roles inherit downward: a higher role can do everything a lower one can.
//
// IMPORTANT: this file owns the source of truth for role ordering. Any
// other code that compares roles MUST go through these helpers; ad-hoc
// comparisons (e.g. role === 'admin' || role === 'owner') drift over time.
import type { WorkspaceMemberRole } from '../db/schema'
import { ForbiddenError } from './errors'

const ROLE_LEVEL = {
  viewer: 0,
  member: 1,
  scrum_master: 2,
  admin: 3,
  owner: 4,
} as const satisfies Record<WorkspaceMemberRole, number>

const ROLE_LABEL: Record<WorkspaceMemberRole, string> = {
  viewer: 'Viewer',
  member: 'Участник',
  scrum_master: 'Scrum Master',
  admin: 'Администратор',
  owner: 'Владелец',
}

export function roleAtLeast(
  actual: WorkspaceMemberRole,
  required: WorkspaceMemberRole,
): boolean {
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required]
}

export function requireMinRole(
  actual: WorkspaceMemberRole,
  required: WorkspaceMemberRole,
): void {
  if (!roleAtLeast(actual, required)) {
    throw new ForbiddenError(`Нужна роль «${ROLE_LABEL[required]}» или выше`)
  }
}

// "Strictly above" — used when actor must outrank a target. E.g. an admin
// may modify members but not owners; an owner may modify anyone, including
// other owners.
export function strictlyOutranks(
  actor: WorkspaceMemberRole,
  target: WorkspaceMemberRole,
): boolean {
  return ROLE_LEVEL[actor] > ROLE_LEVEL[target]
}
