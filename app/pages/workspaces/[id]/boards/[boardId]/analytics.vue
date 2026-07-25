<script setup lang="ts">
import type { AnalyticsRange } from '~/composables/api/useAnalyticsApi'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const range = ref<AnalyticsRange>(30)
const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: 14, label: '14 дн' },
  { value: 30, label: '30 дн' },
  { value: 90, label: '90 дн' },
]

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { cfd, cycleTime, throughput, wipRecommendations } = useAnalyticsApi(wsId, bId, range)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value
    ? `${board.value.name} — Аналитика`
    : 'Аналитика — Такт',
})
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" :can-rename="canRenameBoard" :board="board" />

    <div class="flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pt-4 pb-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="m-0 text-2xl font-semibold tracking-tight text-default sm:text-[28px]">Аналитика</h1>
          <p class="text-sm text-muted">Поток, прогноз и рекомендации по доске</p>
        </div>
        <div class="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-elevated p-0.5">
          <button
            v-for="r in RANGES"
            :key="r.value"
            type="button"
            class="h-7 cursor-pointer rounded-md px-2.5 text-[12px] font-medium tabular-nums transition-colors"
            :class="range === r.value ? 'bg-default text-default shadow-sm' : 'text-muted hover:text-default'"
            @click="range = r.value"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <AnalyticsOverview
        :workspace-id="wsId"
        :board-id="bId"
        :range-days="range"
        :throughput="throughput.data.value"
        :cycle-time="cycleTime.data.value"
        :wip="wipRecommendations.data.value"
        :loading="throughput.isLoading.value"
      />

      <AnalyticsCfdChart :report="cfd.data.value" :is-loading="cfd.isLoading.value" />

      <div class="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-12">
        <AnalyticsThroughputChart
          class="xl:col-span-6"
          :report="throughput.data.value"
          :is-loading="throughput.isLoading.value"
        />
        <AnalyticsCycleTimeScatter
          class="xl:col-span-6"
          :report="cycleTime.data.value"
          :is-loading="cycleTime.isLoading.value"
        />
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-12">
        <AnalyticsMonteCarloCard class="xl:col-span-8" :workspace-id="wsId" :board-id="bId" />
        <AnalyticsForecastAccuracyCard class="xl:col-span-4" :workspace-id="wsId" :board-id="bId" />
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-12">
        <AnalyticsWipRecommendationsCard
          class="xl:col-span-8"
          :report="wipRecommendations.data.value"
          :is-loading="wipRecommendations.isLoading.value"
        />
        <AnalyticsTimeReportCard class="xl:col-span-4" :workspace-id="wsId" :board-id="bId" />
      </div>
    </div>
  </div>
</template>
