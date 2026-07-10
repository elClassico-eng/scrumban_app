import { useMutation, useQuery } from '@tanstack/vue-query'
import { apiRoutes } from '~/routing'
import type { SprintNetworkReport } from '#shared/types/network'
import type { ScenarioChange, ScenarioSimulationReport } from '#shared/types/scenario'

export function useSandboxSimulator() {
  const network = useQuery({
    queryKey: ['sandbox-simulator-network'],
    queryFn: () => $fetch<SprintNetworkReport>(apiRoutes.sandboxSimulatorNetwork),
    staleTime: 60_000,
  })

  const simulate = useMutation({
    mutationFn: (changes: ScenarioChange[]) =>
      $fetch<ScenarioSimulationReport>(apiRoutes.sandboxSimulatorSimulate, {
        method: 'POST',
        body: { changes },
      }),
  })

  return { network, simulate }
}
