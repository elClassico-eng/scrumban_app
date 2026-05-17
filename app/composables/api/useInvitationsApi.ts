import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'

export type WorkspaceMemberRole = 'viewer' | 'member' | 'scrum_master' | 'admin' | 'owner'

export interface InvitationListItem {
  id: string
  role: WorkspaceMemberRole
  email: string | null
  createdAt: string
  expiresAt: string
  createdByEmail: string
}

export interface InvitationsListResponse {
  invitations: InvitationListItem[]
}

export interface CreateInvitationInput {
  role: WorkspaceMemberRole
  email?: string
}

export interface CreateInvitationResponse {
  invitation: {
    id: string
    role: WorkspaceMemberRole
    email: string | null
    expiresAt: string
    createdAt: string
  }
  token: string
}

export function useInvitationsApi(workspaceId: MaybeRef<string>) {
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: computed(() => ['invitations', unref(workspaceId)]),
    queryFn: () =>
      $fetch<InvitationsListResponse>(apiRoutes.workspaceInvitations(unref(workspaceId))),
    enabled: computed(() => !!unref(workspaceId)),
  })

  const create = useMutation({
    mutationFn: (input: CreateInvitationInput) =>
      $fetch<CreateInvitationResponse>(
        apiRoutes.workspaceInvitations(unref(workspaceId)),
        { method: 'POST', body: input },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations', unref(workspaceId)] }),
  })

  const cancel = useMutation({
    mutationFn: (invitationId: string) =>
      $fetch(apiRoutes.workspaceInvitation(unref(workspaceId), invitationId), {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations', unref(workspaceId)] }),
  })

  return { list, create, cancel }
}