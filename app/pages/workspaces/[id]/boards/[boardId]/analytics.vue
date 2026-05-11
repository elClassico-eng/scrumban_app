<script setup lang="ts">
const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: boardsList } = useBoardsApi(wsId)
const { cfd, cycleTime, throughput, wipRecommendations } = useAnalyticsApi(wsId, bId)

const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)

useHead({
  title: () => board.value
    ? `${board.value.name} — Аналитика`
    : 'Аналитика — Scrumban',
})
</script>

<template>
  <div class="space-y-4">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" />

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
      <AnalyticsWipRecommendationsCard
        :report="wipRecommendations.data.value"
        :is-loading="wipRecommendations.isLoading.value"
      />
    </div>
  </div>
</template>
