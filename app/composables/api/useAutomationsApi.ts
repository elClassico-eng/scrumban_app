import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { apiRoutes } from '~/routing'
import type {
  AutomationFiringsResponse,
  AutomationRuleResponse,
  AutomationRulesResponse,
  AutomationRunResponse,
  RuleInput,
} from '#shared/types/automation'

export function useAutomationsApi(workspaceId: MaybeRef<string>, boardId: MaybeRef<string>) {
  const qc = useQueryClient()
  const queryKey = computed(() => ['automations', unref(workspaceId), unref(boardId)])
  const enabled = computed(() => !!unref(workspaceId) && !!unref(boardId))
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKey.value })

  const rules = useQuery({
    queryKey: computed(() => [...queryKey.value, 'rules']),
    queryFn: () => $fetch<AutomationRulesResponse>(apiRoutes.automationRules(unref(workspaceId), unref(boardId))),
    enabled,
  })

  const firings = useQuery({
    queryKey: computed(() => [...queryKey.value, 'firings']),
    queryFn: () => $fetch<AutomationFiringsResponse>(apiRoutes.automationFirings(unref(workspaceId), unref(boardId))),
    enabled,
  })

  const create = useMutation({
    mutationFn: (input: RuleInput) =>
      $fetch<AutomationRuleResponse>(apiRoutes.automationRules(unref(workspaceId), unref(boardId)), {
        method: 'POST',
        body: input,
      }),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ ruleId, ...patch }: { ruleId: string } & Partial<RuleInput>) =>
      $fetch<AutomationRuleResponse>(apiRoutes.automationRule(unref(workspaceId), unref(boardId), ruleId), {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (ruleId: string) =>
      $fetch(apiRoutes.automationRule(unref(workspaceId), unref(boardId), ruleId), { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const run = useMutation({
    mutationFn: () =>
      $fetch<AutomationRunResponse>(apiRoutes.automationRun(unref(workspaceId), unref(boardId)), { method: 'POST' }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return { rules, firings, create, update, remove, run }
}
