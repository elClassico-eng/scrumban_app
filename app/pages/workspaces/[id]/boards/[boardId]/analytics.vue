<script setup lang="ts">
const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { cfd, cycleTime, throughput, wipRecommendations } = useAnalyticsApi(wsId, bId)

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

    <div class="flex-1 min-h-0 overflow-y-auto pt-4 pb-4">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnalyticsCfdChart
        class="lg:col-span-2"
        :report="cfd.data.value"
        :is-loading="cfd.isLoading.value"
      />
      <AnalyticsCycleTimeScatter
        :report="cycleTime.data.value"
        :is-loading="cycleTime.isLoading.value"
      />
      <AnalyticsThroughputChart
        :report="throughput.data.value"
        :is-loading="throughput.isLoading.value"
      />
      <AnalyticsMonteCarloCard :workspace-id="wsId" :board-id="bId" />
      <AnalyticsForecastAccuracyCard :workspace-id="wsId" :board-id="bId" />
      <AnalyticsWipRecommendationsCard
        :report="wipRecommendations.data.value"
        :is-loading="wipRecommendations.isLoading.value"
      />
      <AnalyticsTimeReportCard :workspace-id="wsId" :board-id="bId" />
      </div>
    </div>
  </div>
</template>
