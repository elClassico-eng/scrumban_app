<script setup lang="ts">
import VChart from 'vue-echarts'
import type { CycleTimeReport } from '#shared/types/analytics'

const props = defineProps<{ report: CycleTimeReport | undefined; isLoading: boolean }>()

const colorMode = useColorMode()
const theme = computed(() => colorMode.value === 'dark' ? 'dark' : undefined)

const option = computed(() => {
  if (!props.report) return {}
  const { samples, stats } = props.report

  const markLines = []
  if (stats.p50Hours != null) {
    markLines.push({ name: 'p50', yAxis: stats.p50Hours / 24, label: { formatter: 'p50' } })
  }
  if (stats.p85Hours != null) {
    markLines.push({ name: 'p85', yAxis: stats.p85Hours / 24, label: { formatter: 'p85' } })
  }
  if (stats.p95Hours != null) {
    markLines.push({ name: 'p95', yAxis: stats.p95Hours / 24, label: { formatter: 'p95' } })
  }

  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [string, number] }) => {
        const [date, days] = p.data
        return `${new Date(date).toLocaleDateString('ru')}<br/>${days.toFixed(1)} дн`
      },
    },
    grid: { top: 20, left: 50, right: 20, bottom: 50 },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', name: 'Дни', nameTextStyle: { padding: [0, 0, 0, 30] } },
    series: [{
      type: 'scatter',
      symbolSize: 10,
      data: samples.map(s => [s.closedAt, s.cycleHours / 24]),
      markLine: {
        symbol: 'none',
        lineStyle: { type: 'dashed' },
        data: markLines,
      },
    }],
  }
})

const hasData = computed(() => (props.report?.samples.length ?? 0) > 0)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Cycle Time</h2>
        <span class="text-xs text-muted">Длительность задачи от создания до закрытия</span>
      </div>
    </template>
    <div v-if="isLoading" class="h-64 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>
    <div v-else-if="!hasData" class="h-64 flex items-center justify-center text-muted text-sm">
      Пока нет закрытых задач — scatter появится после первого закрытия
    </div>
    <template v-else>
      <div class="grid grid-cols-4 gap-3 mb-3 text-center">
        <div>
          <p class="text-xs text-muted">Образцов</p>
          <p class="font-mono font-semibold">{{ report!.stats.count }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">Среднее</p>
          <p class="font-mono font-semibold">
            {{ report!.stats.meanHours != null ? (report!.stats.meanHours / 24).toFixed(1) + ' дн' : '—' }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">p50</p>
          <p class="font-mono font-semibold">
            {{ report!.stats.p50Hours != null ? (report!.stats.p50Hours / 24).toFixed(1) + ' дн' : '—' }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">p85</p>
          <p class="font-mono font-semibold">
            {{ report!.stats.p85Hours != null ? (report!.stats.p85Hours / 24).toFixed(1) + ' дн' : '—' }}
          </p>
        </div>
      </div>
      <VChart :option="option" :theme="theme" autoresize class="h-64" />
    </template>
  </UCard>
</template>