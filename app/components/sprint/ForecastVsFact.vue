<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'

const props = defineProps<{ sprint: Sprint }>()

const { history } = useForecastJournalApi(
  computed(() => props.sprint.workspaceId),
  computed(() => props.sprint.boardId),
)
const historyQuery = history(computed(() => props.sprint.id))

const anchor = computed(() =>
  historyQuery.data.value?.snapshots.find(s => s.trigger === 'sprint_start') ?? null,
)

const actualDays = computed(() => {
  if (!props.sprint.startedAt || !props.sprint.endedAt) return null
  const ms = new Date(props.sprint.endedAt).getTime() - new Date(props.sprint.startedAt).getTime()
  return Math.round((ms / 86_400_000) * 10) / 10
})

const view = computed(() => {
  if (!anchor.value || actualDays.value === null) return null
  const p85 = anchor.value.payload.simulation.p85Days
  const prob = anchor.value.payload.simulation.probabilityWithinHorizon
  const errorDays = Math.round((actualDays.value - p85) * 10) / 10
  return {
    p85,
    prob: prob === null ? null : Math.round(prob * 100),
    actual: actualDays.value,
    errorDays,
    hit: actualDays.value <= p85,
  }
})
</script>

<template>
  <div v-if="view" class="bg-muted rounded-lg px-3 py-2.5 space-y-1">
    <div class="flex items-center gap-1.5">
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">Прогноз vs факт</span>
      <AnalyticsInfo
        answers="Снапшот прогноза, сделанный в момент старта спринта, сверяется с фактической длительностью после закрытия."
        action="Если спринты систематически не укладываются в свой P85 — оценки оптимистичны: сокращайте скоуп или пересматривайте зависимости."
      />
      <div class="flex-1" />
      <span
        class="text-[10.5px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded"
        :class="view.hit
          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
          : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300'"
      >
        {{ view.hit ? 'в P85 уложился' : 'в P85 не уложился' }}
      </span>
    </div>
    <div class="text-[12px] text-default tabular-nums">
      P85 на старте: <b>{{ view.p85 }} дн</b> · факт: <b>{{ view.actual }} дн</b> ·
      ошибка <b>{{ view.errorDays > 0 ? '+' : '' }}{{ view.errorDays }} дн</b>
    </div>
    <div v-if="view.prob !== null" class="text-[11px] text-muted">
      Вероятность уложиться к дате оценивалась в {{ view.prob }}%
    </div>
  </div>
</template>
