<script setup lang="ts">
import VChart from 'vue-echarts'
import type { CfdReport } from '#shared/types/analytics'

const props = defineProps<{ report: CfdReport | undefined; isLoading: boolean }>()

const { tokens, flowRamp, textStyle, tooltip, categoryAxis, valueAxis } = useChartTheme()

const option = computed(() => {
  if (!props.report) return {}
  const { columns, points } = props.report
  const c = tokens.value
  const dates = points.map(p => p.date.slice(0, 10))
  const ramp = flowRamp(columns.length)
  const series = columns.map((col, i) => ({
    name: col.name,
    type: 'line',
    stack: 'total',
    smooth: 0.2,
    showSymbol: false,
    lineStyle: { color: c.surface, width: 1.5 },
    itemStyle: { color: ramp[i] },
    areaStyle: { color: ramp[i], opacity: 0.9 },
    emphasis: { focus: 'series' },
    data: points.map(p => p.counts[col.id] ?? 0),
  }))

  return {
    color: ramp,
    textStyle: textStyle.value,
    tooltip: { ...tooltip.value, trigger: 'axis' },
    legend: {
      top: 0,
      type: 'scroll',
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      textStyle: { color: c.sub, fontSize: 12, fontFamily: 'inherit' },
    },
    grid: { top: 40, left: 40, right: 16, bottom: 32 },
    xAxis: categoryAxis({ boundaryGap: false, data: dates }),
    yAxis: valueAxis(),
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
    <VChart v-else :option="option" autoresize class="h-64" />
  </UCard>
</template>