<script setup lang="ts">
const props = defineProps<{
  workspaceId: string
  boardId: string
  sprintId: string
}>()

const { report } = useSprintNetworkApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
  computed(() => props.sprintId),
)

const data = computed(() => report.data.value ?? null)
const okData = computed(() => (data.value?.ok ? data.value : null))

const showGraph = ref(false)

const titleById = computed(() => {
  const map = new Map<string, string>()
  for (const t of okData.value?.tasks ?? []) map.set(t.taskId, t.title)
  return map
})

const criticalChainTitles = computed(() =>
  (okData.value?.criticalPathIds ?? []).map(id => titleById.value.get(id) ?? '…'),
)

const riskTasks = computed(() => {
  const tasks = [...(okData.value?.tasks ?? [])]
  return tasks
    .sort((a, b) => Number(b.critical) - Number(a.critical) || a.slackDays - b.slackDays)
    .slice(0, 6)
})

const naiveProbability = computed(() => {
  const naive = okData.value?.naive
  return naive && naive.ok ? naive.probability : null
})

const verdict = computed(() => {
  const p = okData.value?.simulation.probabilityWithinHorizon
  if (p === null || p === undefined) return null
  if (p >= 0.8) return { label: 'По графику', cls: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' }
  if (p >= 0.5) return { label: 'Под вопросом', cls: 'bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300' }
  return { label: 'Риск срыва', cls: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' }
})

function pct(p: number | null | undefined): string {
  return p === null || p === undefined ? '—' : `${Math.round(p * 100)}`
}
</script>

<template>
  <div class="bg-default border border-default rounded-2xl px-6 py-6 space-y-4">
    <div class="flex items-center gap-2">
      <h4 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0 inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-git-branch" class="size-3.5" />
        Сетевой прогноз · CPM + PERT
      </h4>
      <AnalyticsInfo
        answers="Прогноз срока спринта с учётом зависимостей. Критический путь — цепочка без резерва, которая определяет дедлайн."
        formula="PERT: ожидаемое = (O+4M+P)/6, σ = (P−O)/6. Симуляция прогоняет сеть 1000 раз. «Наивный MC» — без зависимостей, для сравнения."
      />
      <span
        v-if="verdict"
        class="text-[10.5px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded"
        :class="verdict.cls"
      >
        {{ verdict.label }}
      </span>
      <div class="flex-1" />
      <UButton
        v-if="okData && okData.remainingCount > 0"
        size="xs"
        variant="outline"
        color="neutral"
        :icon="showGraph ? 'i-lucide-chevron-up' : 'i-lucide-network'"
        @click="showGraph = !showGraph"
      >
        {{ showGraph ? 'Скрыть сеть' : 'Показать сеть' }}
      </UButton>
    </div>

    <div v-if="report.isLoading.value" class="text-[12.5px] text-muted py-3">
      Считаем сеть…
    </div>

    <div v-else-if="data && !data.ok" class="flex items-start gap-2.5 py-1">
      <UIcon name="i-lucide-database" class="size-4 text-muted shrink-0 mt-0.5" />
      <p class="text-[12.5px] text-muted m-0 leading-relaxed">
        Недостаточно истории для оценок: закрыто <b class="text-default">{{ data.closedSamples }}</b> задач из
        {{ data.requiredSamples }} необходимых. Закрывайте задачи — прогноз появится сам.
      </p>
    </div>

    <template v-else-if="okData">
      <div v-if="okData.remainingCount === 0" class="text-[12.5px] text-muted py-1">
        Все задачи спринта закрыты — прогнозировать нечего.
      </div>

      <template v-else>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div class="bg-muted rounded-lg px-3 py-2.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Ожидаемо</div>
            <div class="text-[22px] font-semibold tracking-tight text-default mt-0.5">
              {{ okData.pert.expectedDurationDays }}<span class="text-[12px] text-muted font-normal ml-0.5">± {{ okData.pert.sigmaDays }} дн</span>
            </div>
            <div class="text-[11px] text-muted mt-0.5">
              <template v-if="okData.horizonDays !== null">горизонт {{ okData.horizonDays }} дн</template>
              <template v-else>дата окончания не задана</template>
            </div>
          </div>
          <div class="bg-muted rounded-lg px-3 py-2.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">PERT</div>
            <div class="text-[22px] font-semibold tracking-tight text-default mt-0.5">
              {{ pct(okData.pert.probabilityWithinHorizon) }}<span class="text-[12px] text-muted font-normal ml-0.5">%</span>
            </div>
            <div class="text-[11px] text-muted mt-0.5">аналитически, к дате</div>
          </div>
          <div class="bg-muted rounded-lg px-3 py-2.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Симуляция</div>
            <div class="text-[22px] font-semibold tracking-tight text-default mt-0.5">
              {{ pct(okData.simulation.probabilityWithinHorizon) }}<span class="text-[12px] text-muted font-normal ml-0.5">%</span>
            </div>
            <div class="text-[11px] text-muted mt-0.5">{{ okData.simulation.iterations }} прогонов по сети</div>
          </div>
          <div class="bg-muted rounded-lg px-3 py-2.5">
            <div class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Наивный MC</div>
            <div class="text-[22px] font-semibold tracking-tight text-default mt-0.5">
              {{ pct(naiveProbability) }}<span class="text-[12px] text-muted font-normal ml-0.5">%</span>
            </div>
            <div class="text-[11px] text-muted mt-0.5">без учёта зависимостей</div>
          </div>
        </div>

        <div class="text-[11px] text-muted tabular-nums">
          Симуляция: P50 <b class="text-default">{{ okData.simulation.p50Days }}</b> дн ·
          P85 <b class="text-default">{{ okData.simulation.p85Days }}</b> дн ·
          P95 <b class="text-default">{{ okData.simulation.p95Days }}</b> дн ·
          история: {{ okData.closedSamples }} закрытых задач · {{ okData.edgeCount }} зависимостей
        </div>

        <div v-if="criticalChainTitles.length > 0" class="space-y-1.5">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Критический путь</div>
          <div class="flex flex-wrap items-center gap-1.5">
            <template v-for="(title, i) in criticalChainTitles" :key="i">
              <span class="text-[11.5px] font-medium px-1.5 py-0.5 rounded bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300">{{ title }}</span>
              <UIcon v-if="i < criticalChainTitles.length - 1" name="i-lucide-arrow-right" class="size-3 text-dimmed" />
            </template>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Задачи и резервы</div>
          <div class="border border-default rounded-lg overflow-hidden bg-default divide-y divide-default">
            <div
              v-for="t in riskTasks"
              :key="t.taskId"
              class="flex items-center gap-2.5 px-3 py-2 text-[12.5px]"
            >
              <span
                class="size-1.5 rounded-full shrink-0"
                :class="t.critical ? 'bg-accent-500' : 'bg-zinc-300 dark:bg-zinc-600'"
              />
              <span class="truncate text-default" :class="t.critical ? 'font-medium' : ''">{{ t.title }}</span>
              <span class="ml-auto shrink-0 tabular-nums text-[11px]" :class="t.critical ? 'text-accent-600 font-semibold' : 'text-muted'">
                {{ t.critical ? 'критическая' : `резерв ${t.slackDays} дн` }} · ~{{ t.expectedDays }} дн
              </span>
            </div>
          </div>
        </div>

        <SprintNetworkGraph
          v-if="showGraph"
          :tasks="okData.tasks"
          :critical-path-ids="okData.criticalPathIds"
        />
      </template>
    </template>
  </div>
</template>