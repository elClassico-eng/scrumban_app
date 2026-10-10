<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'
import { resolveOutcome } from '#shared/utils/forecast-outcome'
import { OUTCOME_CLASS, OUTCOME_LABEL } from '~/utils/forecast-labels'

const props = defineProps<{ sprint: Sprint }>()

const { history } = useForecastJournalApi(
  computed(() => props.sprint.workspaceId),
  computed(() => props.sprint.boardId),
)
const historyQuery = history(computed(() => props.sprint.id))

const anchor = computed(() => historyQuery.data.value?.snapshots.find(s => s.trigger === 'sprint_start') ?? null)
const closeSnap = computed(() => historyQuery.data.value?.snapshots.find(s => s.trigger === 'sprint_close') ?? null)

const view = computed(() => {
  if (!anchor.value) return null
  const o = resolveOutcome({
    startedAt: props.sprint.startedAt ? new Date(props.sprint.startedAt) : null,
    start: anchor.value.payload,
    close: closeSnap.value?.payload ?? null,
  })
  const p85 = anchor.value.payload.simulation.p85Days
  const prob = anchor.value.payload.simulation.probabilityWithinHorizon
  return {
    ...o,
    p85,
    prob: prob === null ? null : Math.round(prob * 100),
    carried: closeSnap.value?.payload.resolution?.carriedCount ?? 0,
    errorDays: o.actualDays === null ? null : Math.round((o.actualDays - p85) * 10) / 10,
  }
})
</script>

<template>
  <div v-if="view" class="bg-muted rounded-lg px-3 py-2.5 space-y-1">
    <div class="flex items-center gap-1.5">
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">Прогноз vs факт</span>
      <AnalyticsInfo
        answers="Снапшот прогноза на старте спринта сверяется с днём закрытия последней задачи состава. Перенос хотя бы одной задачи считается промахом."
        action="Если спринты систематически не укладываются в свой P85, оценки оптимистичны: сокращай скоуп или пересматривай зависимости."
      />
      <div class="flex-1" />
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded" :class="OUTCOME_CLASS[view.outcome]">
        {{ OUTCOME_LABEL[view.outcome] }}
      </span>
    </div>
    <div class="text-[12px] text-default tabular-nums">
      P85 на старте: <b>{{ view.p85 }} дн</b>
      <template v-if="view.actualDays !== null"> · факт: <b>{{ view.actualDays }} дн</b> · ошибка <b>{{ (view.errorDays ?? 0) > 0 ? '+' : '' }}{{ view.errorDays }} дн</b></template>
      <template v-else-if="view.outcome === 'carryover'"> · перенесено задач: <b>{{ view.carried }}</b></template>
      <template v-else> · исход не определён</template>
    </div>
    <div v-if="view.prob !== null" class="text-[11px] text-muted">
      Вероятность уложиться к дате оценивалась в {{ view.prob }}%
    </div>
    <SprintForecastConvergence
      :workspace-id="sprint.workspaceId"
      :board-id="sprint.boardId"
      :sprint-id="sprint.id"
      :actual-days="view.actualDays"
      class="pt-1"
    />
  </div>
</template>
