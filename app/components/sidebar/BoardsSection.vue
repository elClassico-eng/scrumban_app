<script setup lang="ts">
import draggable from 'vuedraggable'
import { pageRoutes } from '~/routing'
import type { Board } from '#shared/types/board'

const props = defineProps<{
  workspaceId: string
  boards: Board[]
  activeBoardId: string | null
  favorites: Set<string>
  collapsed: boolean
  canCreate: boolean
  archivedCount: number
}>()
const emit = defineEmits<{
  reorder: [ids: string[]]
  toggleFavorite: [boardId: string]
  create: []
}>()

const local = ref<Board[]>([])
watch(() => props.boards, (b) => { local.value = [...b] }, { immediate: true })

function onEnd() {
  emit('reorder', local.value.map(b => b.id))
}
</script>

<template>
  <div>
    <SidebarSectionLabel v-if="collapsed" label="Доски" collapsed />
    <div v-else class="flex items-center pt-5 pb-1.5 pl-3 pr-1.5">
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        class="flex-1 text-[11px] font-semibold uppercase tracking-wider text-dimmed transition-colors hover:text-default"
      >
        Доски
      </NuxtLink>
      <button
        v-if="canCreate"
        type="button"
        class="grid size-6 place-items-center rounded-md text-dimmed transition-colors hover:bg-elevated hover:text-default"
        aria-label="Создать доску"
        @click="emit('create')"
      >
        <UIcon name="i-hugeicons-plus" class="size-3.5" />
      </button>
    </div>

    <p v-if="!local.length && !collapsed" class="px-3 py-2 text-xs text-dimmed">
      Нет досок
    </p>
    <draggable
      v-model="local"
      item-key="id"
      class="flex flex-col gap-0.5"
      ghost-class="opacity-40"
      animation="150"
      filter="input"
      :prevent-on-filter="false"
      :disabled="collapsed"
      @end="onEnd"
    >
      <template #item="{ element }">
        <div>
          <SidebarBoardLink
            :workspace-id="workspaceId"
            :board="element"
            :active="activeBoardId === element.id"
            :favorite="favorites.has(element.id)"
            :collapsed="collapsed"
            @toggle-favorite="emit('toggleFavorite', element.id)"
          />
        </div>
      </template>
    </draggable>
    <NuxtLink
      v-if="archivedCount && !collapsed"
      :to="{ path: pageRoutes.boards(workspaceId), query: { archive: '1' } }"
      class="mt-0.5 flex items-center gap-3 rounded-xl py-1.5 pl-3 pr-2.5 text-xs text-dimmed transition-colors hover:bg-elevated hover:text-default"
    >
      <UIcon name="i-hugeicons-archive" class="size-5 shrink-0 p-0.5" />
      <span class="flex-1">Архив</span>
      <span class="tabular-nums">{{ archivedCount }}</span>
    </NuxtLink>
  </div>
</template>
