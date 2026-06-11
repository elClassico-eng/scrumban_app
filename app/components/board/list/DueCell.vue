<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { DueInfo } from '~/utils/due'
defineProps<{
  task: Task
  due: DueInfo | null
  isDone: boolean
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()
function label(d: DueInfo): string {
  if (d.diff === 1) return 'завтра'
  return d.dateLabel
}
</script>

<template>
  <span v-if="due && isDone" class="inline-flex items-center gap-[5px] text-xs text-emerald-600 tabular-nums">
    <UIcon name="i-lucide-calendar" class="size-3" />{{ due.dateLabel }}
  </span>
  <span v-else-if="due && due.tone === 'overdue'" class="inline-flex items-center gap-[5px] text-xs text-white bg-red-500 px-2.5 py-0.5 rounded-full font-semibold tabular-nums">
    <UIcon name="i-lucide-calendar" class="size-3" />{{ due.dateLabel }}
  </span>
  <span v-else-if="due && due.tone === 'today'" class="inline-flex items-center gap-[5px] text-xs text-white bg-accent-500 px-2.5 py-0.5 rounded-full font-semibold tabular-nums">
    <UIcon name="i-lucide-calendar" class="size-3" />сегодня
  </span>
  <span v-else-if="due && due.tone === 'soon'" class="inline-flex items-center gap-[5px] text-xs text-accent-600 font-semibold tabular-nums">
    <UIcon name="i-lucide-calendar" class="size-3 text-accent-500" />{{ label(due) }}
  </span>
  <span v-else-if="due" class="inline-flex items-center gap-[5px] text-xs text-toned tabular-nums">
    <UIcon name="i-lucide-calendar" class="size-3 text-muted" />{{ due.dateLabel }}
  </span>
  <span v-else class="inline-flex items-center gap-[5px] text-xs text-dimmed">
    <UIcon name="i-lucide-calendar" class="size-3" />—
  </span>
</template>
