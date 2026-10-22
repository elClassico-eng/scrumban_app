<script setup lang="ts">
import { Motion } from 'motion-v'
import { pageRoutes } from '~/routing'
import { SIDEBAR_SPRING } from '~/utils/sidebar-items'
import type { Board } from '#shared/types/board'

const props = defineProps<{
  workspaceId: string
  board: Board
  active: boolean
  favorite: boolean
  collapsed: boolean
  indicator?: string
}>()
const emit = defineEmits<{ toggleFavorite: [] }>()

const letter = computed(() => props.board.name.trim().charAt(0).toUpperCase() || '·')
</script>

<template>
  <UTooltip :text="board.name" :disabled="!collapsed" :content="{ side: 'right' }">
    <NuxtLink
      :to="pageRoutes.board(workspaceId, board.id)"
      :aria-current="active ? 'page' : undefined"
      :class="[
        'group relative flex items-center rounded-xl text-sm font-medium transition-colors duration-200',
        collapsed ? 'justify-center p-2' : 'gap-3 py-2 pl-3 pr-1.5',
        active ? 'text-highlighted font-semibold' : 'text-muted hover:bg-elevated hover:text-default',
      ]"
    >
      <Motion
        v-if="active"
        :layout-id="indicator ?? 'sidebar-active'"
        class="absolute inset-0 rounded-xl bg-accented"
        :transition="SIDEBAR_SPRING"
      />
      <span
        class="relative grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
        :style="{ background: board.color }"
      >{{ letter }}</span>
      <template v-if="!collapsed">
        <span class="relative min-w-0 flex-1 truncate">{{ board.name }}</span>
        <button
          type="button"
          :class="[
            'relative grid size-6 shrink-0 place-items-center rounded-md transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-default active:scale-75',
            favorite ? 'text-accent-600 dark:text-accent-400 opacity-100' : 'text-dimmed opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          ]"
          :aria-label="favorite ? 'Убрать из избранного' : 'В избранное'"
          :aria-pressed="favorite"
          @click.prevent.stop="emit('toggleFavorite')"
        >
          <UIcon name="i-hugeicons-star" class="size-3.5" />
        </button>
      </template>
    </NuxtLink>
  </UTooltip>
</template>
