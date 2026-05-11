import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  MembersListResponse,
  AddMemberInput,
  UpdateMemberRoleInput,
} from '#shared/types/workspace'

export function useMembersApi(workspaceId: MaybeRef<string>) {
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: computed(() => ['members', unref(workspaceId)]),
    queryFn: () => $fetch<MembersListResponse>(apiRoutes.members(unref(workspaceId))),
    enabled: computed(() => !!unref(workspaceId)),
  })

  const add = useMutation({
    mutationFn: (input: AddMemberInput) =>
      $fetch(apiRoutes.members(unref(workspaceId)), { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', unref(workspaceId)] }),
  })

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string } & UpdateMemberRoleInput) =>
      $fetch(apiRoutes.member(unref(workspaceId), userId), {
        method: 'PATCH',
        body: { role },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', unref(workspaceId)] }),
  })

  const remove = useMutation({
    mutationFn: (userId: string) =>
      $fetch(apiRoutes.member(unref(workspaceId), userId), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', unref(workspaceId)] }),
  })

  return { list, add, updateRole, remove }
}