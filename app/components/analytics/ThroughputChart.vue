<script setup lang="ts">
import VChart from 'vue-echarts'
import type { ThroughputReport } from '#shared/types/analytics'

const props = defineProps<{ report: ThroughputReport | undefined; isLoading: boolean }>()

const { tokens, textStyle, tooltip, categoryAxis, valueAxis } = useChartTheme()

const option = computed(() => {
  if (!props.report) return {}
  const buckets = props.report.buckets
  const c = tokens.value
  return {
    textStyle: textStyle.value,
    tooltip: { ...tooltip.value, trigger: 'axis', valueFormatter: (v: number) => `${v} задач` },
    grid: { top: 16, left: 36, right: 16, bottom: 32 },
    xAxis: categoryAxis({ boundaryGap: false, data: buckets.map(b => b.bucket.slice(0, 10)) }),
    yAxis: valueAxis({ minInterval: 1 }),
    series: [{
      type: 'line',
      smooth: 0.35,
      showSymbol: false,
      symbolSize: 7,
      lineStyle: { color: c.accent, width: 2 },
      itemStyle: { color: c.accent, borderColor: c.surface, borderWidth: 1.5 },
      emphasis: { focus: 'series', scale: 1.4 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: c.accentDim },
            { offset: 1, color: 'rgba(232, 80, 2, 0)' },
          ],
        },
      },
      data: buckets.map(b => b.count),
    }],
  }
})

const hasData = computed(() => (props.report?.buckets.length ?? 0) > 0)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">Throughput</h2>
          <AnalyticsInfo
            answers="Сколько задач закрывается в день. Стабильность важнее величины — ровный throughput даёт точный прогноз."
            formula="Число закрытых задач в каждом дневном бакете. Это вход для Monte Carlo прогноза."
          />
        </div>
        <span class="text-xs text-muted">Закрытых задач в день</span>
      </div>
    </template>
    <div v-if="isLoading" class="h-48 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>
    <div v-else-if="!hasData" class="h-48 flex items-center justify-center text-center text-muted text-sm px-6">
      Здесь появится throughput — сколько задач закрывается в день. Закройте несколько задач, чтобы увидеть тренд.
    </div>
    <VChart v-else :option="option" autoresize class="h-48" />
  </UCard>
</template>