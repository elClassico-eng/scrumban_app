import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'

export type WorkspaceMemberRole = 'viewer' | 'member' | 'scrum_master' | 'admin' | 'owner'

export interface MyInvitation {
  id: string
  role: WorkspaceMemberRole
  workspaceId: string
  workspaceName: string
  createdAt: string
  expiresAt: string
}

export interface MyInvitationsResponse {
  invitations: MyInvitation[]
}

export interface AcceptResponse {
  ok: true
  workspaceId: string
  alreadyMember: boolean
  currentRole: WorkspaceMemberRole
}

export function useMyInvitationsApi() {
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['me', 'invitations'],
    queryFn: () => $fetch<MyInvitationsResponse>(apiRoutes.myInvitations),
  })

  const accept = useMutation({
    mutationFn: (invitationId: string) =>
      $fetch<AcceptResponse>(apiRoutes.myInvitationAccept(invitationId), { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'invitations'] })
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })

  return { list, accept }
}
