<script setup lang="ts">
import type { SprintNetworkReport } from '#shared/types/network'
import type { ScenarioSimulationReport } from '#shared/types/scenario'

const props = defineProps<{
  baseline: Extract<SprintNetworkReport, { ok: true }>
  report: ScenarioSimulationReport | null
}>()

const okReport = computed(() => (props.report?.ok ? props.report : null))

const shownTasks = computed(() => okReport.value?.scenario.tasks ?? props.baseline.tasks)
const shownCriticalIds = computed(() => okReport.value?.scenario.criticalPathIds ?? props.baseline.criticalPathIds)

const excludedTasks = computed(() => {
  const r = okReport.value
  if (!r) return []
  const inScenario = new Set(r.scenario.tasks.map(t => t.taskId))
  return props.baseline.tasks.filter(t => !inScenario.has(t.taskId))
})

const titleById = computed(() => {
  const m = new Map<string, string>()
  for (const t of props.baseline.tasks) m.set(t.taskId, t.title)
  return m
})

const criticalChainTitles = computed(() =>
  shownCriticalIds.value.map(id => titleById.value.get(id) ?? '…'),
)
</script>

<template>
  <div class="bg-default border border-default rounded-2xl px-5 py-5 space-y-4">
    <div class="flex items-center gap-2">
      <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0 inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-network" class="size-3.5" />
        Сеть {{ okReport ? 'сценария' : 'спринта' }}
      </h4>
      <span
        v-if="okReport"
        class="text-[10.5px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300"
      >
        что-если
      </span>
    </div>

    <SprintNetworkGraph
      :tasks="shownTasks"
      :critical-path-ids="shownCriticalIds"
    />

    <div v-if="excludedTasks.length > 0" class="space-y-1.5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Исключены в сценарии</div>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="t in excludedTasks"
          :key="t.taskId"
          class="text-[11.5px] px-1.5 py-0.5 rounded bg-elevated text-muted line-through"
        >{{ t.title }}</span>
      </div>
    </div>

    <div v-if="criticalChainTitles.length > 0" class="space-y-1.5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        Критический путь {{ okReport ? 'сценария' : '' }}
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <template v-for="(title, i) in criticalChainTitles" :key="i">
          <span class="text-[11.5px] font-medium px-1.5 py-0.5 rounded bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300">{{ title }}</span>
          <UIcon v-if="i < criticalChainTitles.length - 1" name="i-lucide-arrow-right" class="size-3 text-dimmed" />
        </template>
      </div>
    </div>
  </div>
</template>
