import type { Role } from '#shared/types/domain'
import { pageRoutes, type MeSection, type WorkspaceSection } from '~/routing'
import { hasRole } from './rbac'

const LEGACY_ME: Record<string, MeSection> = {
  profile: 'profile',
  security: 'security',
  notifications: 'notifications',
  appearance: 'appearance',
  danger: 'account',
}

const LEGACY_WORKSPACE: Record<string, WorkspaceSection> = {
  team: 'general',
  integrations: 'integrations',
}

export function legacySettingsPath(tab: string | undefined, currentWorkspaceId: string | null): string {
  if (tab && LEGACY_ME[tab]) return pageRoutes.settings(LEGACY_ME[tab])
  if (tab && LEGACY_WORKSPACE[tab] && currentWorkspaceId) return pageRoutes.workspaceSettings(currentWorkspaceId, LEGACY_WORKSPACE[tab])
  return pageRoutes.settings()
}

export function visibleWorkspaceSections(role: Role): WorkspaceSection[] {
  return [
    'general',
    'storage',
    'integrations',
    ...(hasRole(role, 'scrum_master') ? ['boards' as const] : []),
    ...(role === 'owner' ? ['delete' as const] : []),
  ]
}
