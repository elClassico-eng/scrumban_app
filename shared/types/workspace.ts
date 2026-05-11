import type { Role } from './domain'

export interface Workspace {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceWithRole extends Workspace {
  role: Role
}

export interface WorkspacesListResponse {
  workspaces: WorkspaceWithRole[]
}

export interface WorkspaceResponse {
  workspace: WorkspaceWithRole
}

export interface CreateWorkspaceInput {
  name: string
  slug: string
}

export interface UpdateWorkspaceInput {
  name?: string
}

export interface MemberView {
  userId: string
  email: string
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