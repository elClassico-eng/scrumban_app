<script setup lang="ts">
import VChart from 'vue-echarts'
import type { ThroughputReport } from '#shared/types/analytics'

const props = defineProps<{ report: ThroughputReport | undefined; isLoading: boolean }>()

const colorMode = useColorMode()
const theme = computed(() => colorMode.value === 'dark' ? 'dark' : undefined)

const option = computed(() => {
  if (!props.report) return {}
  const buckets = props.report.buckets
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, left: 40, right: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: buckets.map(b => b.bucket.slice(0, 10)),
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{
      type: 'line',
      smooth: 0.3,
      showSymbol: true,
      data: buckets.map(b => b.count),
      areaStyle: { opacity: 0.2 },
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
    <VChart v-else :option="option" :theme="theme" autoresize class="h-48" />
  </UCard>
</template>