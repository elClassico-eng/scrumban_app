<script setup lang="ts">
import VChart from 'vue-echarts'
import type { CfdReport } from '#shared/types/analytics'

const props = defineProps<{ report: CfdReport | undefined; isLoading: boolean }>()

const colorMode = useColorMode()
const theme = computed(() => colorMode.value === 'dark' ? 'dark' : undefined)

const option = computed(() => {
  if (!props.report) return {}
  const { columns, points } = props.report
  const dates = points.map(p => p.date.slice(0, 10))
  const series = columns.map(col => ({
    name: col.name,
    type: 'line',
    stack: 'total',
    areaStyle: {},
    smooth: 0.2,
    showSymbol: false,
    emphasis: { focus: 'series' },
    data: points.map(p => p.counts[col.id] ?? 0),
  }))

  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, type: 'scroll' },
    grid: { top: 40, left: 50, right: 20, bottom: 40 },
    xAxis: { type: 'category', boundaryGap: false, data: dates },
    yAxis: { type: 'value' },
    series,
  }
})

const hasData = computed(() => (props.report?.points.length ?? 0) > 0)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">Cumulative Flow</h2>
          <AnalyticsInfo
            answers="Сколько задач в каждой стадии в каждый день. Где полоса растёт — там копится работа; наклон верхней границы — throughput."
            formula="Строится из событий перехода задач (task_events), а не из снимков доски."
          />
        </div>
        <span class="text-xs text-muted">Накопленный поток задач по колонкам</span>
      </div>
    </template>
    <div v-if="isLoading" class="h-64 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>
    <div v-else-if="!hasData" class="h-64 flex items-center justify-center text-muted text-sm">
      Пока нет данных для CFD — нужны движения задач по колонкам
    </div>
    <VChart v-else :option="option" :theme="theme" autoresize class="h-64" />
  </UCard>
</template>