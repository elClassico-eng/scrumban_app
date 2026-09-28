<script setup lang="ts">
import VChart from 'vue-echarts'
import type { MonteCarloReport } from '#shared/types/analytics'

const props = defineProps<{
  workspaceId: string
  boardId: string
}>()

const { tokens, textStyle, tooltip, categoryAxis, valueAxis } = useChartTheme()

const tasksRemaining = ref(10)
const horizonDays = ref(30)

const { list: tasksList } = useTasksApi(computed(() => props.workspaceId), computed(() => props.boardId))
const { list: sprintsList } = useSprintsApi(computed(() => props.workspaceId), computed(() => props.boardId))
const userEdited = ref(false)
const whatIfOpen = ref(false)

const boardRemaining = computed(() => {
  const tasks = tasksList.data.value?.tasks
  if (!tasks) return null
  return tasks.filter(t => t.closedAt == null).length
})

const sprintHorizon = computed(() => {
  const s = sprintsList.data.value?.sprints.find(x => x.state === 'active')
  if (!s?.plannedEndAt) return null
  return Math.max(1, Math.ceil((new Date(s.plannedEndAt).getTime() - Date.now()) / 86_400_000))
})

watch([boardRemaining, sprintHorizon], ([rem, hor]) => {
  if (userEdited.value) return
  if (rem != null && rem > 0) tasksRemaining.value = rem
  if (hor != null) horizonDays.value = hor
}, { immediate: true })

const params = computed(() => ({
  tasksRemaining: tasksRemaining.value,
  horizonDays: horizonDays.value,
}))

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const { monteCarlo } = useAnalyticsApi(wsId, bId)
const mc = monteCarlo(params)

const isOk = computed(() => mc.data.value?.ok === true)
const report = computed(() => mc.data.value as MonteCarloReport | undefined)

// Percentiles are a duration measured from today, the horizon is a date. Showing
// both as day counts invites comparing them against the wrong thing, so every
// forecast figure is rendered as a calendar date.
const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
function dateIn(days: number): string {
  return dateFmt.format(new Date(Date.now() + days * 86_400_000))
}

const horizonDate = computed(() => dateIn(horizonDays.value))

const histogramOption = computed(() => {
  if (!report.value || !report.value.ok) return {}
  const throughputs = report.value.historicalDailyThroughput
  // Bucket counts of each daily throughput value (0, 1, 2, ...).
  const counts = new Map<number, number>()
  for (const t of throughputs) counts.set(t, (counts.get(t) ?? 0) + 1)
  const keys = [...counts.keys()].sort((a, b) => a - b)
  const c = tokens.value
  return {
    textStyle: textStyle.value,
    tooltip: {
      ...tooltip.value,
      trigger: 'axis',
      valueFormatter: (v: number) => `${v} дней`,
    },
    grid: { top: 10, left: 32, right: 12, bottom: 28 },
    xAxis: categoryAxis({
      data: keys.map(String),
      name: 'задач/день',
      nameGap: 22,
      nameTextStyle: { color: c.axisLabel, fontSize: 10 },
    }),
    yAxis: valueAxis({ minInterval: 1 }),
    series: [{
      type: 'bar',
      barMaxWidth: 26,
      itemStyle: { color: c.accent, borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: c.accent, opacity: 0.85 } },
      data: keys.map(k => counts.get(k) ?? 0),
    }],
  }
})
</script>

<template>
  <UCard :ui="ANALYTICS_CARD_UI">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <h2 class="font-semibold">Monte Carlo прогноз</h2>
          <AnalyticsInfo
            answers="Вероятность закрыть оставшиеся задачи за горизонт. P85 = срок, в который укладываемся в 85% симуляций."
            formula="≥1000 симуляций: на каждый день берём случайный throughput из истории (bootstrap), копим до закрытия всех задач. Распределение исходов → перцентили."
          />
        </div>
        <span class="text-xs text-muted">Когда успеем доделать оставшиеся задачи</span>
      </div>
    </template>

    <button
      type="button"
      class="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent-600 transition-colors mb-3"
      @click="whatIfOpen = !whatIfOpen"
    >
      <UIcon :name="whatIfOpen ? 'i-lucide-chevron-up' : 'i-lucide-flask-conical'" class="size-3.5" />
      Что-если: изменить вводные
    </button>

    <div v-if="whatIfOpen" class="mb-4 space-y-2">
      <div class="flex items-end gap-3">
        <div>
          <p class="text-xs text-muted mb-1">Осталось задач</p>
          <UInput v-model="tasksRemaining" type="number" min="1" size="sm" class="w-28" @update:model-value="userEdited = true" />
        </div>
        <div>
          <p class="text-xs text-muted mb-1">Горизонт (дни)</p>
          <UInput v-model="horizonDays" type="number" min="1" size="sm" class="w-28" @update:model-value="userEdited = true" />
        </div>
      </div>
      <p class="text-[11px] text-muted">Заполнено из реальных данных доски (открытые задачи, дедлайн активного спринта). Измените вводные, чтобы проверить сценарий.</p>
    </div>

    <div v-if="mc.isLoading.value" class="h-48 flex items-center justify-center text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div v-else-if="report && !report.ok" class="space-y-2 py-6 text-center">
      <UIcon name="i-lucide-chart-no-axes-combined" class="size-10 text-muted mx-auto" />
      <p class="text-sm font-medium">Недостаточно истории</p>
      <p class="text-xs text-muted">
        Нужно ≥{{ report.requiredDays }} дней закрытых задач, у нас {{ report.sampleDays }}
      </p>
    </div>

    <template v-else-if="report && isOk && report.ok">
      <p class="mb-1 text-sm text-default">
        При текущем темпе оставшиеся задачи закончатся
        <b>{{ dateIn(report.percentileDays.p85) }}</b> с вероятностью 85%.
      </p>
      <div class="mb-4 grid grid-cols-3 gap-3">
        <div>
          <p class="text-xs text-muted">P50 · половина сценариев</p>
          <p class="font-mono text-lg font-semibold">{{ dateIn(report.percentileDays.p50) }}</p>
        </div>
        <div>
          <p class="inline-flex items-center gap-1 text-xs text-muted">P85 <AnalyticsPercentileHint /></p>
          <p class="font-mono text-lg font-semibold">{{ dateIn(report.percentileDays.p85) }}</p>
        </div>
        <div>
          <p class="text-xs text-muted">P95 · почти наверняка</p>
          <p class="font-mono text-lg font-semibold">{{ dateIn(report.percentileDays.p95) }}</p>
        </div>
      </div>
      <div
        class="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-elevated/60 px-4 py-3 text-sm"
      >
        <span class="text-muted">Успеть к горизонту <b class="text-default">{{ horizonDate }}</b>:</span>
        <b
          :class="report.probability >= 0.85
            ? 'text-success-600'
            : report.probability >= 0.5 ? 'text-accent-600' : 'text-error-600'"
        >{{ (report.probability * 100).toFixed(0) }}%</b>
      </div>
      <p class="text-xs text-muted text-center mb-2">
        Распределение дневной throughput ({{ report.sampleDays }} дней истории, {{ report.iterations }} итераций):
      </p>
      <VChart :option="histogramOption" autoresize class="h-32" />
    </template>
  </UCard>
</template>