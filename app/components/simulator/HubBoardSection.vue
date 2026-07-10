<script setup lang="ts">
import type { Board } from '#shared/types/board'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  wsId: string
  board: Board
}>()

const { list: sprintsList } = useSprintsApi(
  computed(() => props.wsId),
  computed(() => props.board.id),
)

const openSprints = computed(() => {
  const all = sprintsList.data.value?.sprints ?? []
  const active = all.filter(s => s.state === 'active')
  const planned = all.filter(s => s.state === 'planned')
  return [...active, ...planned]
})
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center gap-2.5">
      <h2 class="text-[12px] font-bold uppercase tracking-[0.08em] text-muted m-0">
        {{ board.name }}
      </h2>
      <span class="text-[11px] font-medium text-muted bg-elevated px-1.5 py-0.5 rounded-full">
        {{ openSprints.length }}
      </span>
      <span class="flex-1 h-px bg-accented" />
      <NuxtLink
        :to="pageRoutes.boardSprints(wsId, board.id)"
        class="text-[11.5px] text-muted hover:text-default transition-colors"
      >
        Спринты доски →
      </NuxtLink>
    </div>

    <div v-if="sprintsList.isLoading.value" class="text-[12px] text-muted">
      Загружаем спринты…
    </div>

    <div v-else-if="openSprints.length === 0" class="text-[12px] text-dimmed">
      Нет открытых спринтов —
      <NuxtLink
        :to="pageRoutes.boardSprints(wsId, board.id)"
        class="underline decoration-dotted hover:text-default transition-colors"
      >создайте спринт</NuxtLink>
      или
      <NuxtLink
        :to="pageRoutes.simulatorDemo(wsId)"
        class="underline decoration-dotted hover:text-default transition-colors"
      >откройте демо-пример</NuxtLink>.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <SimulatorHubSprintCard
        v-for="s in openSprints"
        :key="s.id"
        :sprint="s"
        :to="pageRoutes.sprintSimulator(wsId, board.id, s.id)"
      />
    </div>
  </section>
</template>
