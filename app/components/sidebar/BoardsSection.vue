<script setup lang="ts">
import draggable from 'vuedraggable'
import { pageRoutes } from '~/routing'
import { SIDEBAR_ROW, sidebarFade } from '~/utils/sidebar-items'
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
    <div class="relative flex h-9 items-end pb-1 pl-3 pr-1.5">
      <span
        :class="['absolute left-5 top-1/2 h-px w-4 -translate-x-1/2 bg-[var(--ui-border-accented)] transition-opacity duration-200', collapsed ? 'opacity-100' : 'opacity-0']"
      />
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        :class="['flex-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-dimmed transition-colors hover:text-default', sidebarFade(collapsed)]"
        :tabindex="collapsed ? -1 : 0"
      >
        Доски
      </NuxtLink>
      <button
        v-if="canCreate"
        type="button"
        :class="['grid size-6 place-items-center rounded-md text-dimmed transition-colors hover:bg-elevated hover:text-default', sidebarFade(collapsed)]"
        :tabindex="collapsed ? -1 : 0"
        aria-label="Создать доску"
        @click="emit('create')"
      >
        <UIcon name="i-hugeicons-plus" class="size-3.5" />
      </button>
    </div>

    <p v-if="!local.length" :class="['px-3 py-2 text-xs text-dimmed', sidebarFade(collapsed)]">
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
      v-if="archivedCount"
      :to="{ path: pageRoutes.boards(workspaceId), query: { archive: '1' } }"
      :class="[SIDEBAR_ROW, 'mt-0.5 pl-3 pr-2.5 text-xs text-dimmed hover:bg-elevated hover:text-default']"
      :title="collapsed ? `Архив досок: ${archivedCount}` : undefined"
    >
      <UIcon name="i-hugeicons-archive" class="size-4 shrink-0" />
      <span :class="['flex-1', sidebarFade(collapsed)]">Архив</span>
      <span :class="['tabular-nums', sidebarFade(collapsed)]">{{ archivedCount }}</span>
    </NuxtLink>
  </div>
</template>
