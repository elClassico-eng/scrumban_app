import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { PachcaCandidate, PachcaChat, PachcaInviteResult, PachcaStateResponse } from '#shared/types/integrations'
import type { InstantNotificationType } from '#shared/types/notification'

export function usePachcaApi(workspaceId: MaybeRef<string | null>) {
  const qc = useQueryClient()
  const url = computed(() => {
    const id = unref(workspaceId)
    return id ? apiRoutes.pachca(id) : ''
  })
  const queryKey = computed(() => ['pachca', unref(workspaceId)])
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKey.value })

  const state = useQuery({
    queryKey,
    queryFn: () => $fetch<PachcaStateResponse>(url.value),
    enabled: computed(() => !!unref(workspaceId)),
  })

  const connect = useMutation({
    mutationFn: (body: { token?: string, signingSecret?: string | null }) => $fetch(url.value, { method: 'PUT', body }),
    onSuccess: invalidate,
  })

  const disconnect = useMutation({
    mutationFn: () => $fetch(url.value, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const inviteAll = useMutation({
    mutationFn: (dryRun: boolean) => $fetch<PachcaInviteResult>(`${url.value}/invite-all`, { method: 'POST', body: { dryRun } }),
  })

  const candidates = (query: string) => $fetch<{ candidates: PachcaCandidate[] }>(`${url.value}/candidates`, { query: { query } })

  const chats = () => $fetch<{ chats: PachcaChat[] }>(`${url.value}/chats`)

  const requestLink = useMutation({
    mutationFn: (pachcaUserId: string) => $fetch(`${url.value}/link`, { method: 'POST', body: { pachcaUserId } }),
  })

  const updateMe = useMutation({
    mutationFn: (body: { instantTypes?: InstantNotificationType[], digest?: boolean }) => $fetch(`${url.value}/me`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })

  const unlinkMe = useMutation({
    mutationFn: () => $fetch(`${url.value}/me`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return { state, connect, disconnect, inviteAll, candidates, chats, requestLink, updateMe, unlinkMe }
}
