<script setup lang="ts">
import VChart from 'vue-echarts'
import type { CycleTimeReport } from '#shared/types/analytics'

const props = defineProps<{ report: CycleTimeReport | undefined; isLoading: boolean }>()

const { tokens, textStyle, tooltip, valueAxis } = useChartTheme()

const option = computed(() => {
  if (!props.report) return {}
  const { samples, stats } = props.report
  const c = tokens.value

  const mark = (label: string, hours: number, emphasis: boolean) => ({
    name: label,
    yAxis: hours / 24,
    lineStyle: {
      color: emphasis ? c.accent : c.axisLabel,
      type: emphasis ? 'solid' as const : 'dashed' as const,
      width: emphasis ? 1.5 : 1,
      opacity: emphasis ? 0.9 : 0.7,
    },
    label: {
      formatter: label,
      position: 'end' as const,
      color: emphasis ? c.accent : c.axisLabel,
      fontSize: 11,
      fontWeight: emphasis ? 600 : 400,
    },
  })

  const markLines = []
  if (stats.p50Hours != null) markLines.push(mark('P50', stats.p50Hours, false))
  if (stats.p85Hours != null) markLines.push(mark('P85', stats.p85Hours, true))
  if (stats.p95Hours != null) markLines.push(mark('P95', stats.p95Hours, false))

  return {
    textStyle: textStyle.value,
    tooltip: {
      ...tooltip.value,
      trigger: 'item',
      formatter: (p: { data: [string, number] }) => {
        const [date, days] = p.data
        return `${new Date(date).toLocaleDateString('ru')} · <b>${days.toFixed(1)} дн</b>`
      },
    },
    grid: { top: 16, left: 40, right: 28, bottom: 36 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: c.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: c.axisLabel, fontSize: 11, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: valueAxis({ name: 'дни', nameTextStyle: { color: c.axisLabel, fontSize: 11, align: 'right', padding: [0, 4, 0, 0] } }),
    series: [{
      type: 'scatter',
      symbolSize: 9,
      itemStyle: { color: c.accent, opacity: 0.55, borderColor: c.surface, borderWidth: 1 },
      emphasis: { itemStyle: { opacity: 0.95, borderWidth: 1.5 }, scale: 1.3 },
      data: samples.map(s => [s.closedAt, s.cycleHours / 24]),
      markLine: {
        symbol: 'none',
        silent: true,
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
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">Cycle Time</h2>
          <AnalyticsInfo
            answers="Сколько каждая задача шла от создания до закрытия. Точка — задача; пунктир p85 = 85% задач закрывались быстрее."
            formula="Перцентили по методу Type-7 на закрытых задачах. Это lead time (создание → закрытие)."
          />
        </div>
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
      <VChart :option="option" autoresize class="h-64" />
    </template>
  </UCard>
</template>