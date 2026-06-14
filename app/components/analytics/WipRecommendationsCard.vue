<script setup lang="ts">
import type { WipRecommendationsReport } from '#shared/types/analytics'

const props = defineProps<{ report: WipRecommendationsReport | undefined; isLoading: boolean }>()

function deltaIcon(current: number, recommended: number): { name: string; color: string } {
  if (current > recommended) return { name: 'i-lucide-arrow-down', color: 'text-warning' }
  if (current < recommended) return { name: 'i-lucide-arrow-up', color: 'text-info' }
  return { name: 'i-lucide-check', color: 'text-success' }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">WIP рекомендации</h2>
          <AnalyticsInfo
            answers="Сколько задач держать в работе одновременно. Если текущий WIP заметно выше рекомендованного — стадия перегружена и задачи застревают."
            formula="Закон Литтла: WIP = throughput × cycle time. Рекомендация = средний throughput × среднее cycle time по истории."
          />
        </div>
        <span class="text-xs text-muted">Little's Law: WIP ≈ throughput × cycle time</span>
      </div>
    </template>

    <div v-if="isLoading" class="h-32 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div v-else-if="report && !report.ok" class="space-y-2 py-6 text-center">
      <UIcon name="i-lucide-chart-no-axes-combined" class="size-10 text-muted mx-auto" />
      <p class="text-sm font-medium">Недостаточно данных</p>
      <p class="text-xs text-muted">
        Нужно ≥{{ report.requiredSamples }} закрытых задач, у нас {{ report.sampleSize }}
      </p>
    </div>

    <template v-else-if="report && report.ok">
      <div class="flex gap-4 text-sm mb-4 pb-3 border-b border-default">
        <div>
          <p class="text-xs text-muted">Throughput</p>
          <p class="font-mono">{{ report.throughputPerDay.toFixed(2) }} задач/день</p>
        </div>
        <div>
          <p class="text-xs text-muted">Cycle time (среднее)</p>
          <p class="font-mono">{{ report.meanCycleTimeDays.toFixed(1) }} дн</p>
        </div>
        <div>
          <p class="text-xs text-muted">Образцов</p>
          <p class="font-mono">{{ report.sampleSize }}</p>
        </div>
      </div>
      <div v-if="report.columns.length === 0" class="text-sm text-muted text-center py-2">
        В доске нет колонок «в работе» / «на ревью»
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="col in report.columns"
          :key="col.columnId"
          class="flex items-center justify-between gap-3 py-1.5"
        >
          <span class="font-medium text-sm">{{ col.name }}</span>
          <div class="flex items-center gap-2 text-sm font-mono">
            <span :class="['text-muted', col.currentTaskCount > col.recommendedWip ? 'text-warning' : '']">
              {{ col.currentTaskCount }}
            </span>
            <UIcon :name="deltaIcon(col.currentTaskCount, col.recommendedWip).name"
                   :class="deltaIcon(col.currentTaskCount, col.recommendedWip).color" />
            <span class="font-semibold">{{ col.recommendedWip }}</span>
            <span class="text-xs text-muted ml-2">
              (limit: {{ col.currentWipLimit ?? '—' }})
            </span>
          </div>
        </div>
      </div>
    </template>
  </UCard>
</template>