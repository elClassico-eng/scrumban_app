<script setup lang="ts">
import type { Task } from '#shared/types/task'
defineProps<{
  task: Task
  cos: { shortLabel: string, dotClass: string }
  canEdit: boolean
  workspaceId: string
  boardId: string
}>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-xs" :class="task.serviceClass === 'expedite' ? 'text-accent-600 font-semibold' : task.serviceClass === 'intangible' ? 'text-muted' : 'text-toned'">
    <span class="size-1.5 rounded-full" :class="cos.dotClass" />
    {{ cos.shortLabel }}
  </span>
</template>
