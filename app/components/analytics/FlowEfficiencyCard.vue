<script setup lang="ts">
import type { FlowEfficiencyReport } from '#shared/types/analytics'

defineProps<{ report: FlowEfficiencyReport | undefined; isLoading: boolean }>()

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function days(hours: number): string {
  return `${(hours / 24).toFixed(1)} дн`
}
</script>

<template>
  <UCard :ui="ANALYTICS_CARD_UI">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">Эффективность потока</h2>
          <AnalyticsInfo
            answers="Какую долю времени задача реально делалась, а не ждала. Низкое значение означает, что сроки съедают очереди и блокеры, а не сама работа."
            formula="Эффективность = активное время / lead time. Ожидание = время в колонках-очередях + время под флагом блокера."
            note="Колонка считается очередью, если включить «Очередь» в её настройках. Backlog помечен очередью по умолчанию."
            action="Сокращай самую большую очередь из списка ниже, а не ускоряй работу."
          />
        </div>
        <span class="text-xs text-muted">Flow efficiency = active / lead time</span>
      </div>
    </template>

    <div v-if="isLoading" class="h-32 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div v-else-if="report && !report.ok" class="space-y-2 py-6 text-center">
      <UIcon name="i-lucide-hourglass" class="size-10 text-muted mx-auto" />
      <p class="text-sm font-medium">Недостаточно данных</p>
      <p class="text-xs text-muted">
        Нужно ≥{{ report.requiredSamples }} закрытых задач за период, у нас {{ report.sampleSize }}
      </p>
    </div>

    <template v-else-if="report && report.ok">
      <div class="flex flex-wrap items-end gap-6 mb-4 pb-3 border-b border-default">
        <div>
          <p class="text-xs text-muted">Эффективность</p>
          <p class="text-3xl font-semibold tabular-nums tracking-tight">{{ pct(report.efficiency) }}</p>
        </div>
        <div class="text-sm">
          <p class="text-xs text-muted">В работе</p>
          <p class="font-mono">{{ days(report.activeHours) }}</p>
        </div>
        <div class="text-sm">
          <p class="text-xs text-muted">В очередях</p>
          <p class="font-mono">{{ days(report.queueHours) }}</p>
        </div>
        <div class="text-sm">
          <p class="text-xs text-muted">В блоке</p>
          <p class="font-mono">{{ days(report.blockedHours) }}</p>
        </div>
        <div class="text-sm">
          <p class="text-xs text-muted">Задач</p>
          <p class="font-mono">{{ report.sampleSize }}</p>
        </div>
      </div>

      <div class="h-2 rounded-full bg-elevated overflow-hidden flex mb-4">
        <div class="bg-accent-500" :style="{ width: pct(report.efficiency) }" />
        <div class="bg-neutral-400/60" :style="{ width: pct(report.totalHours ? report.queueHours / report.totalHours : 0) }" />
        <div class="bg-red-500/70" :style="{ width: pct(report.totalHours ? report.blockedHours / report.totalHours : 0) }" />
      </div>

      <p class="text-xs text-muted mb-2">Где задачи ждут</p>
      <div class="space-y-2">
        <div
          v-for="col in report.columns"
          :key="col.columnId"
          class="flex items-center justify-between gap-3 py-1.5"
        >
          <span class="flex items-center gap-2 text-sm font-medium">
            {{ col.name }}
            <span
              v-if="col.isQueue"
              class="h-5 px-1.5 rounded text-[11px] font-medium inline-flex items-center bg-elevated text-muted"
            >
              очередь
            </span>
          </span>
          <div class="flex items-center gap-3 text-sm font-mono">
            <span class="text-muted">{{ days(col.waitHours) }}</span>
            <span class="font-semibold w-10 text-right">{{ pct(col.share) }}</span>
          </div>
        </div>
      </div>
    </template>
  </UCard>
</template>
