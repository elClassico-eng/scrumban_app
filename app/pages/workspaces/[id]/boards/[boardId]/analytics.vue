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

    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-4 pb-8 space-y-8">
      <section class="space-y-3">
        <div class="flex items-center gap-3">
          <h1 class="text-[22px] font-semibold tracking-tight text-default m-0">Обзор потока</h1>
          <span class="flex-1 h-px bg-default" />
          <div class="inline-flex items-center gap-0.5 bg-default border border-default rounded-lg p-0.5 shrink-0">
            <button
              v-for="r in RANGES"
              :key="r.value"
              type="button"
              class="h-7 px-2.5 rounded-md text-[12px] font-medium tabular-nums cursor-pointer transition-colors"
              :class="range === r.value ? 'bg-inverted text-inverted' : 'text-muted hover:text-default'"
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
      </section>

      <section class="space-y-3.5">
        <div class="flex items-center gap-2.5">
          <UIcon name="i-lucide-waves" class="size-4 text-accent-500" />
          <h2 class="text-[13px] font-bold uppercase tracking-[0.09em] text-default m-0">Поток</h2>
          <span class="flex-1 h-px bg-default" />
        </div>

        <AnalyticsCfdChart :report="cfd.data.value" :is-loading="cfd.isLoading.value" />

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsThroughputChart :report="throughput.data.value" :is-loading="throughput.isLoading.value" />
          <AnalyticsCycleTimeScatter :report="cycleTime.data.value" :is-loading="cycleTime.isLoading.value" />
        </div>
      </section>

      <section class="space-y-3.5">
        <div class="flex items-center gap-2.5">
          <UIcon name="i-lucide-git-branch" class="size-4 text-accent-500" />
          <h2 class="text-[13px] font-bold uppercase tracking-[0.09em] text-default m-0">Прогноз</h2>
          <span class="flex-1 h-px bg-default" />
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsMonteCarloCard :workspace-id="wsId" :board-id="bId" />
          <AnalyticsForecastAccuracyCard :workspace-id="wsId" :board-id="bId" />
        </div>
      </section>

      <section class="space-y-3.5">
        <div class="flex items-center gap-2.5">
          <UIcon name="i-lucide-lightbulb" class="size-4 text-accent-500" />
          <h2 class="text-[13px] font-bold uppercase tracking-[0.09em] text-default m-0">Рекомендации</h2>
          <span class="flex-1 h-px bg-default" />
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <AnalyticsWipRecommendationsCard :report="wipRecommendations.data.value" :is-loading="wipRecommendations.isLoading.value" />
          <AnalyticsTimeReportCard :workspace-id="wsId" :board-id="bId" />
        </div>
      </section>
    </div>
  </div>
</template>
