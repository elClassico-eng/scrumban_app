<script setup lang="ts">
import { pageRoutes } from '~/routing'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: boardsList } = useBoardsApi(wsId)
const boards = computed(() => boardsList.data.value?.boards ?? [])

useHead({ title: 'Симулятор — Такт' })
</script>

<template>
  <div class="space-y-5">
    <SimulatorHubHero />

    <div v-if="boardsList.isLoading.value" class="text-[12.5px] text-muted py-6">
      Загружаем доски…
    </div>

    <div
      v-else-if="boards.length === 0"
      class="bg-default border border-default rounded-2xl px-6 py-10 text-center space-y-2"
    >
      <UIcon name="i-lucide-square-kanban" class="size-8 text-dimmed" />
      <p class="text-[13px] text-muted m-0">
        В этом workspace пока нет досок — симулировать нечего.
      </p>
      <UButton size="sm" variant="outline" color="neutral" :to="pageRoutes.boards(wsId)">
        К доскам
      </UButton>
    </div>

    <template v-else>
      <SimulatorHubBoardSection
        v-for="board in boards"
        :key="board.id"
        :ws-id="wsId"
        :board="board"
      />
    </template>
  </div>
</template>
