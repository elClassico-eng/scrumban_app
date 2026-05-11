<script setup lang="ts">
const route = useRoute()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList, remove: removeBoard } = useBoardsApi(wsId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const boards = computed(() => boardsList.data.value?.boards ?? [])
const canCreate = computed(() => hasRole(workspace.value?.role, 'admin'))
const canDelete = canCreate

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Доски`
    : 'Доски — Scrumban',
})

const createOpen = ref(false)

async function onRemove(boardId: string, name: string) {
  if (!confirm(`Удалить доску «${name}»? Все её колонки и задачи будут потеряны.`)) return
  removeBoard.mutate(boardId)
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          {{ workspace?.name ?? 'Workspace' }}
        </h1>
        <p class="text-sm text-muted mt-1">Доски этого воркспейса</p>
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        @click="createOpen = true"
      >
        Создать доску
      </UButton>
    </div>

    <div v-if="boardsList.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else-if="boards.length === 0" class="text-center py-12">
      <div class="space-y-3">
        <UIcon name="i-lucide-kanban-square" class="size-12 text-muted mx-auto" />
        <div>
          <p class="font-medium">В этом workspace пока нет досок</p>
          <p class="text-sm text-muted mt-1">
            {{ canCreate ? 'Создай первую, чтобы начать работу.' : 'Попроси админа создать доску.' }}
          </p>
        </div>
        <UButton v-if="canCreate" icon="i-lucide-plus" @click="createOpen = true">
          Создать доску
        </UButton>
      </div>
    </UCard>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="board in boards" :key="board.id" class="group h-full">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <h2 class="font-semibold truncate">{{ board.name }}</h2>
            <UButton
              v-if="canDelete"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              :loading="removeBoard.isPending.value"
              @click.prevent="onRemove(board.id, board.name)"
            />
          </div>
          <p class="text-xs text-muted font-mono">{{ board.slug }}</p>
        </div>
      </UCard>
    </div>

    <BoardCreateModal v-if="canCreate" v-model:open="createOpen" :workspace-id="wsId" />
  </div>
</template>