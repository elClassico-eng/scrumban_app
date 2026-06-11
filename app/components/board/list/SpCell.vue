<script setup lang="ts">
import type { Task } from '#shared/types/task'
defineProps<{
  task: Task
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()
</script>

<template>
  <span class="font-mono text-xs font-semibold tabular-nums" :class="task.storyPoints == null ? 'text-dimmed' : 'text-toned'">
    {{ task.storyPoints == null ? '—' : task.storyPoints }}
  </span>
</template>
