import type { Role } from './domain'

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  purpose: string | null
  industry: string | null
  logoUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceWithRole extends Workspace {
  role: Role
}

export type WorkspaceListItem = WorkspaceWithRole & { myLabel: string | null }

export interface WorkspacesListResponse {
  workspaces: WorkspaceListItem[]
}

export interface WorkspaceResponse {
  workspace: WorkspaceWithRole
}

export interface CreateWorkspaceInput {
  name: string
  slug: string
  description?: string
  purpose?: string
  industry?: string
}

export interface UpdateWorkspaceInput {
  name?: string
  description?: string | null
  purpose?: string | null
  industry?: string | null
  logoUrl?: string | null
}

export interface MemberView {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  middleName: string | null
  avatarUrl: string | null
  jobTitle: string | null
  role: Role
  createdAt: string
}

export interface MembersListResponse {
  members: MemberView[]
}

export interface AddMemberInput {
  email: string
  role: Role
}

export interface UpdateMemberRoleInput {
  role: Role
}