<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { Board } from '#shared/types/board'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const boards = computed(() => boardsList.data.value?.boards ?? [])
const canCreate = computed(() => hasRole(workspace.value?.role, 'admin'))
const canManage = canCreate

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} – Доски`
    : 'Доски – Такт',
})

const createOpen = ref(false)
const canDelete = computed(() => hasRole(workspace.value?.role, 'owner'))
const actions = useBoardActions(wsId)

const archivedList = useArchivedBoards(wsId, canManage)
const archived = computed(() => archivedList.data.value?.boards ?? [])
const archiveOpen = ref(route.query.archive === '1')
watch(() => route.query.archive, (v) => { if (v === '1') archiveOpen.value = true })

function menuItems(board: Board) {
  return [
    [
      { label: 'Изменить', icon: 'i-hugeicons-pencil', onSelect: () => actions.askEdit(board) },
      { label: 'Скопировать ссылку', icon: 'i-hugeicons-link-01', onSelect: () => actions.copyLink(board) },
    ],
    [
      { label: 'В архив', icon: 'i-hugeicons-archive', onSelect: () => actions.archive(board) },
      ...(canDelete.value
        ? [{ label: 'Удалить навсегда', icon: 'i-hugeicons-delete-02', color: 'error' as const, onSelect: () => actions.askDelete(board) }]
        : []),
    ],
  ]
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
        icon="i-hugeicons-plus"
        size="lg"
        class="py-2.5 w-full sm:w-auto justify-center shrink-0"
        @click="createOpen = true"
      >
        Создать доску
      </UButton>
    </div>

    <div v-if="boardsList.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-hugeicons-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="boards.length === 0"
      class="text-center py-16 space-y-3 rounded-3xl border border-dashed border-default"
    >
      <UIcon name="i-hugeicons-square-kanban" class="size-12 text-muted mx-auto" />
      <p class="font-medium">В этом workspace пока нет досок</p>
      <p class="text-sm text-muted">
        {{ canCreate ? 'Создайте первую, чтобы начать работу.' : 'Попросите админа создать доску.' }}
      </p>
      <UButton v-if="canCreate" icon="i-hugeicons-plus" size="lg" @click="createOpen = true">
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
            <h2 class="flex min-w-0 items-center gap-2.5 text-lg font-semibold tracking-tight text-default">
              <BoardAvatar :board="board" size="sm" />
              <span class="truncate">{{ board.name }}</span>
            </h2>
            <div v-if="canManage" class="shrink-0" @click.prevent.stop>
              <UDropdownMenu :items="menuItems(board)" :ui="{ content: 'w-48' }">
                <button
                  type="button"
                  class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default transition-colors cursor-pointer"
                  title="Действия"
                >
                  <UIcon name="i-hugeicons-more-horizontal" class="size-4" />
                </button>
              </UDropdownMenu>
            </div>
          </div>
          <p class="text-xs text-muted font-mono">{{ board.slug }}</p>
        </div>

        <div class="inline-flex items-center gap-1.5 text-xs font-medium text-default group-hover:text-accent-600 border-b border-current pb-0.5 w-fit transition-all group-hover:translate-x-1">
          Открыть
          <UIcon name="i-hugeicons-arrow-right-02" class="size-3.5" />
        </div>
      </NuxtLink>
    </div>

    <section v-if="canManage && archived.length" id="archive" class="pt-2">
      <button
        type="button"
        class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-default"
        :aria-expanded="archiveOpen"
        @click="archiveOpen = !archiveOpen"
      >
        <UIcon name="i-hugeicons-archive" class="size-4" />
        Архив
        <span class="font-normal text-dimmed">{{ archived.length }}</span>
        <UIcon name="i-hugeicons-arrow-down-01" :class="['size-4 transition-transform', archiveOpen ? 'rotate-180' : '']" />
      </button>
      <ul v-if="archiveOpen" class="surface mt-3 divide-y divide-default overflow-hidden rounded-2xl">
        <li v-for="board in archived" :key="board.id" class="flex items-center gap-3 px-4 py-3">
          <BoardAvatar :board="board" size="sm" class="opacity-60" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-default">{{ board.name }}</span>
            <span v-if="board.archivedAt" class="block text-xs text-dimmed">
              в архиве с {{ new Date(board.archivedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long' }) }}
            </span>
          </span>
          <UButton size="xs" color="neutral" variant="outline" icon="i-hugeicons-undo-02" @click="actions.restore(board)">
            Восстановить
          </UButton>
          <UButton
            v-if="canDelete"
            size="xs"
            color="error"
            variant="ghost"
            icon="i-hugeicons-delete-02"
            aria-label="Удалить навсегда"
            @click="actions.askDelete(board)"
          />
        </li>
      </ul>
    </section>

    <BoardCreateModal v-if="canCreate" v-model:open="createOpen" :workspace-id="wsId" />

  </div>
</template>