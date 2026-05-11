<script setup lang="ts">
import type { Task } from '#shared/types/task'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: columnsList } = useColumnsApi(wsId, bId)
const { list: tasksList } = useTasksApi(wsId, bId)

// Open the SSE subscription for realtime invalidation while this page is mounted.
useBoardSse(wsId, bId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const board = computed(() =>
  boardsList.data.value?.boards.find(b => b.id === bId.value),
)
const columns = computed(() => columnsList.data.value?.columns ?? [])
const tasks = computed(() => tasksList.data.value?.tasks ?? [])

const tasksByColumn = computed(() => {
  const groups = new Map<string, Task[]>()
  for (const task of tasks.value) {
    const arr = groups.get(task.columnId) ?? []
    arr.push(task)
    groups.set(task.columnId, arr)
  }
  // Each group needs stable position-sorted order so DnD math lines up.
  for (const [k, v] of groups) {
    groups.set(k, [...v].sort((a, b) => a.position - b.position))
  }
  return groups
})

const canCreateColumns = computed(() => hasRole(workspace.value?.role, 'admin'))
const canCreateTasks = computed(() => hasRole(workspace.value?.role, 'member'))

useHead({
  title: () => board.value
    ? `${board.value.name} — Scrumban`
    : 'Доска — Scrumban',
})

const createColumnOpen = ref(false)

const isLoading = computed(() =>
  columnsList.isLoading.value || tasksList.isLoading.value,
)
</script>

<template>
  <div class="space-y-4 h-full flex flex-col">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" />

    <div class="flex justify-end">
      <UButton
        v-if="canCreateColumns"
        icon="i-lucide-plus"
        @click="createColumnOpen = true"
      >
        Колонка
      </UButton>
    </div>

    <div v-if="isLoading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else-if="columns.length === 0" class="text-center py-12">
      <div class="space-y-3">
        <UIcon name="i-lucide-columns-3" class="size-12 text-muted mx-auto" />
        <div>
          <p class="font-medium">В доске пока нет колонок</p>
          <p class="text-sm text-muted mt-1">
            {{ canCreateColumns ? 'Создай первую, чтобы добавлять задачи.' : 'Попроси админа настроить колонки.' }}
          </p>
        </div>
        <UButton v-if="canCreateColumns" icon="i-lucide-plus" @click="createColumnOpen = true">
          Создать колонку
        </UButton>
      </div>
    </UCard>

    <div
      v-else
      class="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0"
    >
      <BoardColumn
        v-for="column in columns"
        :key="column.id"
        :column="column"
        :tasks="tasksByColumn.get(column.id) ?? []"
        :workspace-id="wsId"
        :board-id="bId"
        :can-create="canCreateTasks"
      />
    </div>

    <TaskDrawer :workspace-id="wsId" :board-id="bId" />
    <BoardCreateColumnModal
      v-if="canCreateColumns"
      v-model:open="createColumnOpen"
      :workspace-id="wsId"
      :board-id="bId"
    />
  </div>
</template>