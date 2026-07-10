<script setup lang="ts">
import { pageRoutes } from '~/routing'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: boardsList } = useBoardsApi(wsId)
const boards = computed(() => boardsList.data.value?.boards ?? [])

const { ready: hintsReady, isDismissed } = useHints()
const introDismissed = computed(() => hintsReady.value && isDismissed('simulator-intro'))

useHead({ title: 'Симулятор — Такт' })
</script>

<template>
  <div class="space-y-5">
    <div v-if="introDismissed" class="flex items-center gap-2.5">
      <h1 class="text-[20px] font-semibold tracking-tight text-highlighted m-0 inline-flex items-center gap-2">
        <UIcon name="i-lucide-flask-conical" class="size-5 text-accent-500" />
        Симулятор решений
      </h1>
      <div class="flex-1" />
      <NuxtLink
        :to="pageRoutes.simulatorDemo(wsId)"
        class="text-[12px] text-muted hover:text-default transition-colors"
      >
        Демо-пример
      </NuxtLink>
      <span class="text-dimmed text-[12px]">·</span>
      <NuxtLink
        to="/docs/math/simulator"
        class="text-[12px] text-muted hover:text-default transition-colors"
      >
        Как это работает →
      </NuxtLink>
    </div>

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
        В этом workspace пока нет досок — но симулятор можно попробовать прямо сейчас на учебном примере.
      </p>
      <div class="flex items-center justify-center gap-2">
        <UButton size="sm" :to="pageRoutes.simulatorDemo(wsId)" icon="i-lucide-flask-conical">
          Открыть демо-пример
        </UButton>
        <UButton size="sm" variant="outline" color="neutral" :to="pageRoutes.boards(wsId)">
          К доскам
        </UButton>
      </div>
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
