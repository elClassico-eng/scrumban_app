<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { Board } from '#shared/types/board'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList, update: updateBoard, remove: removeBoard } = useBoardsApi(wsId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const boards = computed(() => boardsList.data.value?.boards ?? [])
const canCreate = computed(() => hasRole(workspace.value?.role, 'admin'))
const canManage = canCreate

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Доски`
    : 'Доски — Scrumban',
})

const createOpen = ref(false)
const confirm = useConfirm()
const toast = useToast()

const renameTarget = ref<Board | null>(null)
const renameOpen = computed({
  get: () => renameTarget.value !== null,
  set: (v) => { if (!v) renameTarget.value = null },
})

function menuItems(board: Board) {
  return [
    {
      label: 'Переименовать',
      icon: 'i-lucide-pencil',
      onSelect: () => { renameTarget.value = board },
    },
    {
      label: 'Удалить',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => onRemove(board),
    },
  ]
}

async function onRename(name: string) {
  if (!renameTarget.value) return
  try {
    await updateBoard.mutateAsync({ boardId: renameTarget.value.id, name })
    renameTarget.value = null
  }
  catch {
    toast.add({ title: 'Не удалось переименовать', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

async function onRemove(board: Board) {
  const ok = await confirm({
    title: `Удалить доску «${board.name}»?`,
    description: 'Все её колонки и задачи будут потеряны. Действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  removeBoard.mutate(board.id)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-3xl font-bold tracking-tight truncate">
          {{ workspace?.name ?? 'Workspace' }}
        </h1>
        <p class="text-sm text-muted mt-1">Доски этой команды</p>
      </div>
      <UButton
        v-if="canCreate"
        icon="i-lucide-plus"
        size="lg"
        class="py-2.5 w-full sm:w-auto justify-center shrink-0"
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
        class="group surface rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md hover:border-accent-300"
      >
        <div class="space-y-2">
          <div class="flex items-start justify-between gap-2">
            <h2 class="text-lg font-semibold tracking-tight truncate text-default">
              {{ board.name }}
            </h2>
            <div v-if="canManage" class="shrink-0" @click.prevent.stop>
              <UDropdownMenu :items="menuItems(board)" :ui="{ content: 'w-48' }">
                <button
                  type="button"
                  class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default transition-colors cursor-pointer"
                  title="Действия"
                >
                  <UIcon name="i-lucide-more-horizontal" class="size-4" />
                </button>
              </UDropdownMenu>
            </div>
          </div>
          <p class="text-xs text-muted font-mono">{{ board.slug }}</p>
        </div>

        <div class="inline-flex items-center gap-1.5 text-xs font-medium text-default group-hover:text-accent-600 border-b border-current pb-0.5 w-fit transition-all group-hover:translate-x-1">
          Открыть
          <UIcon name="i-lucide-arrow-right" class="size-3.5" />
        </div>
      </NuxtLink>
    </div>

    <BoardCreateModal v-if="canCreate" v-model:open="createOpen" :workspace-id="wsId" />

    <CommonRenameModal
      v-if="renameTarget"
      v-model:open="renameOpen"
      entity-label="доску"
      :current-name="renameTarget.name"
      :loading="updateBoard.isPending.value"
      @submit="onRename"
    />
  </div>
</template>