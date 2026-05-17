import type { Role } from '#shared/types/domain'

export const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Наблюдатель',
  member: 'Участник',
  scrum_master: 'Скрам-мастер',
  admin: 'Администратор',
  owner: 'Владелец',
}

export const ROLE_LABEL_PLURAL: Record<Role, string> = {
  viewer: 'Наблюдатели',
  member: 'Участники',
  scrum_master: 'Скрам-мастера',
  admin: 'Админы',
  owner: 'Владельцы',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  viewer: 'Только просмотр, без редактирования',
  member: 'Создаёт и закрывает задачи, комментирует',
  scrum_master: 'Управление спринтами, ретро, аналитикой',
  admin: 'Управление участниками, досками, ролями',
  owner: 'Полный контроль, биллинг и удаление workspace',
}

export const ROLE_DOT_CLASS: Record<Role, string> = {
  viewer: 'bg-neutral-400',
  member: 'bg-info-500',
  scrum_master: 'bg-secondary-500',
  admin: 'bg-accent-500',
  owner: 'bg-secondary-500',
}

export const ROLE_CHIP_CLASS: Record<Role, string> = {
  viewer: 'bg-elevated text-muted',
  member: 'bg-info-50 text-info-700',
  scrum_master: 'bg-secondary-50 text-secondary-700',
  admin: 'bg-accent-50 text-accent-700',
  owner: 'bg-secondary-50 text-secondary-700',
}

export const ROLE_STRIPE_CLASS: Record<Role, string> = {
  viewer: 'bg-neutral-300',
  member: 'bg-info-500',
  scrum_master: 'bg-secondary-500',
  admin: 'bg-accent-500',
  owner: 'bg-secondary-500',
}

export const ROLE_STAT_ICON_CLASS: Record<Role, string> = {
  viewer: 'bg-info-50 text-info-600',
  member: 'bg-info-50 text-info-600',
  scrum_master: 'bg-secondary-50 text-secondary-600',
  admin: 'bg-accent-50 text-accent-600',
  owner: 'bg-secondary-50 text-secondary-600',
}

export const ROLE_ORDER: Record<Role, number> = {
  viewer: 0,
  member: 1,
  scrum_master: 2,
  admin: 3,
  owner: 4,
}

export const ROLE_HIERARCHY: ReadonlyArray<Role> = [
  'owner',
  'admin',
  'scrum_master',
  'member',
  'viewer',
] as const

export function roleOptionsBelow(actor: Role | undefined): Array<{ label: string, value: Role }> {
  if (!actor) return []
  return ROLE_HIERARCHY
    .filter(r => ROLE_ORDER[r] < ROLE_ORDER[actor])
    .map(r => ({ label: ROLE_LABEL[r], value: r }))
}

export function canEditMemberRole(actor: Role | undefined, target: Role): boolean {
  if (!actor) return false
  return ROLE_ORDER[actor] > ROLE_ORDER[target]
}
