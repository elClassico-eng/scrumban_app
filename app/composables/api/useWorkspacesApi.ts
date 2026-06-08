import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type {
  WorkspacesListResponse,
  WorkspaceResponse,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from '#shared/types/workspace'

export function useWorkspacesApi() {
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => $fetch<WorkspacesListResponse>(apiRoutes.workspaces),
  })

  const create = useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      $fetch<WorkspaceResponse>(apiRoutes.workspaces, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })

  const update = useMutation({
    mutationFn: ({ workspaceId, ...input }: { workspaceId: string } & UpdateWorkspaceInput) =>
      $fetch<WorkspaceResponse>(apiRoutes.workspace(workspaceId), {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })

  const remove = useMutation({
    mutationFn: (workspaceId: string) =>
      $fetch<{ ok: boolean }>(apiRoutes.workspace(workspaceId), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })

  const setLabel = useMutation({
    mutationFn: ({ workspaceId, label }: { workspaceId: string; label: string | null }) =>
      $fetch<{ label: string | null }>(apiRoutes.workspaceLabel(workspaceId), {
        method: 'PUT',
        body: { label },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })

  return { list, create, update, remove, setLabel }
}
