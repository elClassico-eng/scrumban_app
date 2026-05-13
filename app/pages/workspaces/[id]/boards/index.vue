<script setup lang="ts">
import { pageRoutes } from '~/routing'

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
const confirm = useConfirm()

async function onRemove(boardId: string, name: string) {
  const ok = await confirm({
    title: `Удалить доску «${name}»?`,
    description: 'Все её колонки и задачи будут потеряны. Действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  removeBoard.mutate(boardId)
}
</script>

<template>
  <div class="space-y-6 max-w-6xl">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">
          {{ workspace?.name ?? 'Workspace' }}
        </h1>
        <p class="text-sm text-muted mt-1">Доски этой команды</p>
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        size="lg"
        class="py-2.5"
        @click="createOpen = true"
      >
        Создать доску
      </UButton>
    </div>

    <div v-if="boardsList.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="boards.length === 0"
      class="text-center py-16 space-y-3 rounded-3xl border border-dashed border-default"
    >
      <UIcon name="i-lucide-kanban-square" class="size-12 text-muted mx-auto" />
      <p class="font-medium">В этом workspace пока нет досок</p>
      <p class="text-sm text-muted">
        {{ canCreate ? 'Создайте первую, чтобы начать работу.' : 'Попросите админа создать доску.' }}
      </p>
      <UButton v-if="canCreate" icon="i-lucide-plus" size="lg" @click="createOpen = true">
        Создать доску
      </UButton>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="board in boards"
        :key="board.id"
        :to="pageRoutes.board(wsId, board.id)"
        class="group glass-strong rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
      >
        <div class="space-y-2">
          <div class="flex items-start justify-between gap-2">
            <h2 class="text-lg font-semibold tracking-tight truncate text-default">
              {{ board.name }}
            </h2>
            <UButton
              v-if="canDelete"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              :loading="removeBoard.isPending.value"
              @click.prevent="onRemove(board.id, board.name)"
            />
          </div>
          <p class="text-xs text-muted font-mono">{{ board.slug }}</p>
        </div>

        <div class="inline-flex items-center gap-1.5 text-xs font-medium text-default border-b border-current pb-0.5 w-fit transition-transform group-hover:translate-x-1">
          Открыть
          <UIcon name="i-lucide-arrow-right" class="size-3.5" />
        </div>
      </NuxtLink>
    </div>

    <BoardCreateModal v-if="canCreate" v-model:open="createOpen" :workspace-id="wsId" />
  </div>
</template>