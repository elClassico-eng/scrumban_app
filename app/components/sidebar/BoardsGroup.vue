<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { Board } from '#shared/types/board'

const props = defineProps<{
  workspaceId: string
  boards: Board[]
  activeBoardId: string | null
  collapsed: boolean
  expanded: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()

const route = useRoute()
const boardsActive = computed(() =>
  route.path.startsWith(`/workspaces/${props.workspaceId}/boards`),
)
</script>

<template>
  <div class="flex flex-col">
    <UTooltip v-if="collapsed" text="Доски" :popper="{ placement: 'right' }">
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        :aria-current="boardsActive ? 'page' : undefined"
        :class="[
          'flex items-center justify-center rounded-xl p-2.5 transition-colors duration-200',
          boardsActive
            ? 'bg-accented text-highlighted'
            : 'text-muted hover:bg-elevated hover:text-default',
        ]"
      >
        <UIcon name="i-lucide-square-kanban" class="size-4 shrink-0" />
      </NuxtLink>
    </UTooltip>

    <div
      v-else
      :class="[
        'group flex items-center rounded-xl pr-1 transition-colors duration-200',
        boardsActive
          ? 'bg-accented'
          : 'hover:bg-elevated',
      ]"
    >
      <NuxtLink
        :to="pageRoutes.boards(workspaceId)"
        :class="[
          'flex flex-1 items-center gap-3 rounded-l-xl py-2.5 pl-3 text-sm font-medium transition-colors',
          boardsActive
            ? 'text-highlighted font-semibold'
            : 'text-muted group-hover:text-default',
        ]"
      >
        <UIcon name="i-lucide-square-kanban" class="size-4 shrink-0" />
        <span class="truncate">Доски</span>
      </NuxtLink>
      <button
        type="button"
        class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-dimmed transition-colors hover:bg-elevated hover:text-default"
        :aria-expanded="expanded"
        aria-label="Показать доски"
        @click="emit('toggle')"
      >
        <UIcon
          name="i-lucide-chevron-down"
          :class="['size-4 transition-transform duration-200', expanded ? 'rotate-180' : '']"
        />
      </button>
    </div>

    <div
      v-if="expanded && !collapsed"
      class="relative mt-1 mb-1 pl-8 before:absolute before:left-[17px] before:top-1 before:bottom-4 before:w-px before:bg-[var(--ui-border)] before:content-['']"
    >
      <p v-if="!boards.length" class="px-3 py-2 text-xs text-dimmed">
        Нет досок
      </p>
      <NuxtLink
        v-for="b in boards"
        :key="b.id"
        :to="pageRoutes.board(workspaceId, b.id)"
        :aria-current="String(activeBoardId) === String(b.id) ? 'page' : undefined"
        :class="[
          'relative flex items-center gap-2.5 rounded-lg py-2 pr-3 pl-3 text-sm font-medium transition-all duration-200',
          String(activeBoardId) === String(b.id)
            ? 'bg-accented text-highlighted font-semibold'
            : 'text-muted hover:bg-elevated hover:text-default',
        ]"
      >
        <span
          class="absolute top-1/2 left-[-15px] h-px w-[11px] -translate-y-1/2"
          :class="String(activeBoardId) === String(b.id) ? 'bg-[var(--ui-border-accented)]' : 'bg-[var(--ui-border)]'"
        />
        <span class="size-[7px] shrink-0 rounded-full" :style="{ background: b.color }" />
        <span class="truncate">{{ b.name }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
