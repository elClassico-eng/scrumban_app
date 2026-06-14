<script setup lang="ts">
import type { Task } from '#shared/types/task'

defineProps<{
  shortId: string
  workspaceName: string | undefined
  boardName: string | undefined
  parentTask: Task | null
  canDelete: boolean
  watching: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-watch': []
  'copy-link': []
  delete: []
  'open-parent-picker': []
}>()
</script>

<template>
  <header
    class="flex items-center gap-2.5 pl-4 pr-3 h-11 border-b border-default shrink-0"
  >
    <span class="text-[12px] text-muted font-mono">{{ shortId }}</span>

    <span class="flex flex-1 items-center gap-1.5 text-[12.5px] text-muted min-w-0 overflow-hidden">
      <span class="text-dimmed">/</span>
      <span class="truncate max-w-[14ch]">{{ workspaceName ?? '' }}</span>
      <span class="text-dimmed">/</span>
      <span class="truncate max-w-[14ch]">{{ boardName ?? '' }}</span>
      <template v-if="parentTask">
        <span class="text-dimmed">/</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12.5px] text-default font-medium bg-elevated hover:bg-accented transition-colors cursor-pointer truncate max-w-[28ch]"
          :title="parentTask.title"
          @click="emit('open-parent-picker')"
        >
          <UIcon name="i-lucide-crown" class="size-3.5 shrink-0" />
          <span class="truncate">{{ parentTask.title }}</span>
        </button>
      </template>
    </span>

    <div class="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        class="size-7 rounded-md grid place-items-center cursor-pointer transition-colors hover:bg-elevated"
        :class="watching ? 'text-accent-500' : 'text-muted hover:text-default'"
        title="Следить"
        @click="emit('toggle-watch')"
      >
        <UIcon name="i-lucide-eye" class="size-4" />
      </button>
      <button
        type="button"
        class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default cursor-pointer transition-colors"
        title="Копировать ссылку"
        @click="emit('copy-link')"
      >
        <UIcon name="i-lucide-link-2" class="size-4" />
      </button>
      <UDropdownMenu
        v-if="canDelete"
        :items="[
          { label: 'Удалить задачу', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('delete') },
        ]"
      >
        <button
          type="button"
          class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default cursor-pointer transition-colors"
          title="Ещё"
        >
          <UIcon name="i-lucide-more-horizontal" class="size-4" />
        </button>
      </UDropdownMenu>
      <span class="w-1.5" />
      <button
        type="button"
        class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default cursor-pointer transition-colors"
        title="Закрыть (Esc)"
        @click="emit('close')"
      >
        <UIcon name="i-lucide-x" class="size-4" />
      </button>
    </div>
  </header>
</template>
