import type { Role } from '#shared/types/domain'

const ORDER: Record<Role, number> = {
  viewer: 0,
  member: 1,
  scrum_master: 2,
  admin: 3,
  owner: 4,
}

export function hasRole(actual: Role | undefined | null, min: Role): boolean {
  return actual != null && ORDER[actual] >= ORDER[min]
}