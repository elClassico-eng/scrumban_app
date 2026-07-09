import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type { ScenarioChange, ScenarioSimulationReport, SprintScenario } from '#shared/types/scenario'

export function useSprintScenariosApi(
  workspaceId: MaybeRef<string>,
  boardId: MaybeRef<string>,
  sprintId: MaybeRef<string>,
) {
  const qc = useQueryClient()
  const key = computed(() => ['sprint-scenarios', unref(workspaceId), unref(boardId), unref(sprintId)])
  const invalidate = () => qc.invalidateQueries({ queryKey: key.value })

  const scenarios = useQuery({
    queryKey: key,
    queryFn: () =>
      $fetch<{ scenarios: SprintScenario[] }>(
        apiRoutes.sprintScenarios(unref(workspaceId), unref(boardId), unref(sprintId)),
      ).then(r => r.scenarios),
    enabled: computed(() => !!unref(workspaceId) && !!unref(boardId) && !!unref(sprintId)),
  })

  const simulate = useMutation({
    mutationFn: (changes: ScenarioChange[]) =>
      $fetch<ScenarioSimulationReport>(
        apiRoutes.sprintScenarioSimulate(unref(workspaceId), unref(boardId), unref(sprintId)),
        { method: 'POST', body: { changes } },
      ),
  })

  const create = useMutation({
    mutationFn: (body: { name: string; changes: ScenarioChange[] }) =>
      $fetch<{ scenario: SprintScenario }>(
        apiRoutes.sprintScenarios(unref(workspaceId), unref(boardId), unref(sprintId)),
        { method: 'POST', body },
      ),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: (input: { scenarioId: string; name?: string; changes?: ScenarioChange[] }) =>
      $fetch<{ scenario: SprintScenario }>(
        apiRoutes.sprintScenario(unref(workspaceId), unref(boardId), unref(sprintId), input.scenarioId),
        { method: 'PATCH', body: { name: input.name, changes: input.changes } },
      ),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (scenarioId: string) =>
      $fetch<{ ok: boolean }>(
        apiRoutes.sprintScenario(unref(workspaceId), unref(boardId), unref(sprintId), scenarioId),
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })

  const apply = useMutation({
    mutationFn: (scenarioId: string) =>
      $fetch<{ scenario: SprintScenario }>(
        apiRoutes.sprintScenarioApply(unref(workspaceId), unref(boardId), unref(sprintId), scenarioId),
        { method: 'POST' },
      ),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['sprint-network', unref(workspaceId), unref(boardId), unref(sprintId)] })
      qc.invalidateQueries({ queryKey: ['tasks', unref(workspaceId), unref(boardId)] })
      qc.invalidateQueries({ queryKey: ['sprints', unref(workspaceId), unref(boardId)] })
      qc.invalidateQueries({ queryKey: ['sprint-memberships', unref(workspaceId), unref(boardId)] })
    },
  })

  return { scenarios, simulate, create, update, remove, apply }
}
