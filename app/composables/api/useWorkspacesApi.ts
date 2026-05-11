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

  return { list, create, update }
}
