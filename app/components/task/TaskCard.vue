<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { TaskPriority } from '#shared/types/domain'

defineProps<{ task: Task }>()

const boardStore = useBoardStore()

const PRIORITY_CONFIG: Record<TaskPriority, { color: 'neutral' | 'info' | 'error'; label: string }> = {
  low: { color: 'neutral', label: 'Низкий' },
  medium: { color: 'info', label: 'Средний' },
  high: { color: 'error', label: 'Высокий' },
}
</script>

<template>
  <div
    class="bg-default border border-default rounded-lg p-3 cursor-grab hover:border-primary/50 hover:shadow-sm transition-all space-y-2"
    @click="boardStore.openTask(task.id)"
  >
    <p class="text-sm font-medium line-clamp-2">{{ task.title }}</p>
    <div class="flex items-center justify-between gap-2">
      <UBadge
        :color="PRIORITY_CONFIG[task.priority].color"
        variant="subtle"
        size="xs"
      >
        {{ PRIORITY_CONFIG[task.priority].label }}
      </UBadge>
      <div
        v-if="task.assigneeId"
        class="size-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center uppercase"
      >
        {{ task.assigneeId.slice(0, 1) }}
      </div>
    </div>
  </div>
</template>