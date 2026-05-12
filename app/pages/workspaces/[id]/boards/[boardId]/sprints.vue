<script setup lang="ts">
import type { SprintState } from '#shared/types/domain'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: sprintsList } = useSprintsApi(wsId, bId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const sprints = computed(() => sprintsList.data.value?.sprints ?? [])

const canManage = computed(() => hasRole(workspace.value?.role, 'scrum_master'))
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value
    ? `${board.value.name} — Спринты`
    : 'Спринты — Scrumban',
})

const STATE_FILTERS: Array<{ label: string; value: SprintState | 'all' }> = [
  { label: 'Все', value: 'all' },
  { label: 'Запланированные', value: 'planned' },
  { label: 'Активные', value: 'active' },
  { label: 'Закрытые', value: 'closed' },
]

const filter = ref<SprintState | 'all'>('all')

const filteredSprints = computed(() => {
  if (filter.value === 'all') return sprints.value
  return sprints.value.filter(s => s.state === filter.value)
})

const createOpen = ref(false)
</script>

<template>
  <div class="space-y-4">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" :can-rename="canRenameBoard" :board="board" />

    <div class="flex items-center justify-between">
      <USelect v-model="filter" :items="STATE_FILTERS" size="sm" class="w-48" />
      <UButton
        v-if="canManage"
        icon="i-lucide-plus"
        @click="createOpen = true"
      >
        Создать спринт
      </UButton>
    </div>

    <div v-if="sprintsList.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else-if="filteredSprints.length === 0" class="text-center py-10">
      <div class="space-y-3">
        <UIcon name="i-lucide-calendar-check-2" class="size-12 text-muted mx-auto" />
        <div>
          <p class="font-medium">
            {{ sprints.length === 0 ? 'Спринтов пока нет' : 'По фильтру ничего не найдено' }}
          </p>
          <p class="text-sm text-muted mt-1">
            {{ canManage && sprints.length === 0 ? 'Создай первый, чтобы начать iteration.' : '' }}
          </p>
        </div>
        <UButton v-if="canManage && sprints.length === 0" icon="i-lucide-plus" @click="createOpen = true">
          Создать спринт
        </UButton>
      </div>
    </UCard>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SprintCard
        v-for="sprint in filteredSprints"
        :key="sprint.id"
        :sprint="sprint"
        :workspace-id="wsId"
        :board-id="bId"
        :can-manage="canManage"
      />
    </div>

    <SprintCreateModal v-if="canManage" v-model:open="createOpen" :workspace-id="wsId" :board-id="bId" />
  </div>
</template>
