<script setup lang="ts">
import type { Task } from '#shared/types/task'

defineProps<{
  task: Task
}>()
</script>

<template>
  <span v-if="task.timeSpentSeconds > 0" class="inline-flex items-center gap-[5px] font-mono text-[12px] text-muted tabular-nums">
    <UIcon name="i-hugeicons-clock-01" class="size-3 shrink-0" />
    {{ formatDuration(task.timeSpentSeconds) }}
  </span>
</template>
