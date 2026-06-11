<script setup lang="ts">
import type { Task } from '#shared/types/task'

defineProps<{
  task: Task
}>()
</script>

<template>
  <span v-if="task.timeSpentSeconds > 0" class="font-mono text-xs text-toned tabular-nums">
    {{ formatDuration(task.timeSpentSeconds) }}
  </span>
  <span v-else class="text-dimmed text-xs">—</span>
</template>
