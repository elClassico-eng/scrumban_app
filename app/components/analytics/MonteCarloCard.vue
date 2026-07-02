<script setup lang="ts">
import VChart from 'vue-echarts'
import type { MonteCarloReport } from '#shared/types/analytics'

const props = defineProps<{
  workspaceId: string
  boardId: string
}>()

const colorMode = useColorMode()
const theme = computed(() => colorMode.value === 'dark' ? 'dark' : undefined)

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

const p85Date = computed(() => {
  const r = report.value
  if (!r?.ok) return null
  return new Date(Date.now() + r.percentileDays.p85 * 86_400_000)
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
})

const histogramOption = computed(() => {
  if (!report.value || !report.value.ok) return {}
  const throughputs = report.value.historicalDailyThroughput
  // Bucket counts of each daily throughput value (0, 1, 2, ...).
  const counts = new Map<number, number>()
  for (const t of throughputs) counts.set(t, (counts.get(t) ?? 0) + 1)
  const keys = [...counts.keys()].sort((a, b) => a - b)
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 10, left: 40, right: 20, bottom: 30 },
    xAxis: { type: 'category', data: keys.map(String), name: 'задач/день' },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{
      type: 'bar',
      data: keys.map(k => counts.get(k) ?? 0),
    }],
  }
})
</script>

<template>
  <UCard>
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
      <p v-if="p85Date" class="text-center text-sm text-default mb-3">
        При текущем темпе: с вероятностью 85% — к <b>{{ p85Date }}</b>
      </p>
      <div class="grid grid-cols-3 gap-3 mb-4 text-center">
        <div>
          <p class="text-xs text-muted">P50</p>
          <p class="font-mono font-semibold text-lg">{{ report.percentileDays.p50 }} дн</p>
        </div>
        <div>
          <p class="text-xs text-muted inline-flex items-center gap-1">P85 <AnalyticsPercentileHint /></p>
          <p class="font-mono font-semibold text-lg">{{ report.percentileDays.p85 }} дн</p>
        </div>
        <div>
          <p class="text-xs text-muted">P95</p>
          <p class="font-mono font-semibold text-lg">{{ report.percentileDays.p95 }} дн</p>
        </div>
      </div>
      <div class="text-center mb-3">
        <UBadge :color="report.probability >= 0.85 ? 'success' : report.probability >= 0.5 ? 'warning' : 'error'" size="lg">
          Вероятность уложиться: {{ (report.probability * 100).toFixed(0) }}%
        </UBadge>
      </div>
      <p class="text-xs text-muted text-center mb-2">
        Распределение дневной throughput ({{ report.sampleDays }} дней истории, {{ report.iterations }} итераций):
      </p>
      <VChart :option="histogramOption" :theme="theme" autoresize class="h-32" />
    </template>
  </UCard>
</template>