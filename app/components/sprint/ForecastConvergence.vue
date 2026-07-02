<script setup lang="ts">
import VChart from 'vue-echarts'

const props = defineProps<{
  workspaceId: string
  boardId: string
  sprintId: string
  actualDays?: number | null
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const accent = computed(() => (isDark.value ? '#ff6a1a' : '#e85002'))
const mutedLine = computed(() => (isDark.value ? '#7e7f8a' : '#9b9ba3'))
const split = computed(() => (isDark.value ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'))
const factColor = computed(() => (isDark.value ? '#34d399' : '#059669'))

const { history } = useForecastJournalApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)
const historyQuery = history(computed(() => props.sprintId))

const snaps = computed(() => historyQuery.data.value?.snapshots ?? [])
const show = computed(() => snaps.value.length >= 3)

const option = computed(() => {
  const labels = snaps.value.map(s =>
    new Date(s.takenAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
  )
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 24, left: 36, right: 16, bottom: 24 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: split.value } },
      axisLabel: { color: mutedLine.value, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: 'дн',
      splitLine: { lineStyle: { color: split.value } },
      axisLabel: { color: mutedLine.value, fontSize: 10 },
    },
    series: [
      {
        name: 'P85',
        type: 'line',
        data: snaps.value.map(s => s.payload.simulation.p85Days),
        lineStyle: { width: 2.5, color: accent.value },
        itemStyle: { color: accent.value },
        symbolSize: 5,
        ...(props.actualDays != null
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                label: { formatter: 'факт', color: factColor.value, fontSize: 10 },
                lineStyle: { color: factColor.value, type: 'dashed', width: 1.5 },
                data: [{ yAxis: props.actualDays }],
              },
            }
          : {}),
      },
      {
        name: 'P50',
        type: 'line',
        data: snaps.value.map(s => s.payload.simulation.p50Days),
        lineStyle: { width: 1.5, color: mutedLine.value, type: 'dashed' },
        itemStyle: { color: mutedLine.value },
        symbolSize: 4,
      },
    ],
  }
})
</script>

<template>
  <div v-if="show" class="space-y-1">
    <div class="flex items-center gap-1.5">
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-muted">Сходимость прогноза</span>
      <AnalyticsInfo
        answers="Как менялся P85/P50-прогноз по ходу спринта (по дневным снапшотам). У честной модели прогноз сходится к факту по мере приближения конца."
        action="Если линия P85 растёт по ходу спринта — скоуп расползается или оценки были оптимистичны с самого начала."
      />
    </div>
    <VChart :option="option" autoresize class="w-full h-32" />
  </div>
</template>
