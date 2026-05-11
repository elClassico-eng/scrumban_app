<script setup lang="ts">
import type { TaskEvent } from '#shared/types/task'
import type { TaskEventType } from '#shared/types/domain'

defineProps<{ events: TaskEvent[] }>()

const EVENT_ICON: Record<TaskEventType, string> = {
  task_created: 'i-lucide-plus-circle',
  task_moved: 'i-lucide-arrow-right-circle',
  task_closed: 'i-lucide-check-circle',
  task_reopened: 'i-lucide-rotate-ccw',
  task_assigned: 'i-lucide-user-check',
  task_updated: 'i-lucide-pencil',
  task_archived: 'i-lucide-archive',
}

const EVENT_COLOR: Record<TaskEventType, string> = {
  task_created: 'text-info',
  task_moved: 'text-primary',
  task_closed: 'text-success',
  task_reopened: 'text-warning',
  task_assigned: 'text-info',
  task_updated: 'text-muted',
  task_archived: 'text-muted',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div v-if="events.length === 0" class="text-sm text-muted text-center py-4">
    Событий пока нет
  </div>
  <ol v-else class="space-y-3">
    <li
      v-for="event in events"
      :key="event.id"
      class="flex gap-3 text-sm"
    >
      <UIcon
        :name="EVENT_ICON[event.eventType]"
        :class="['size-4 shrink-0 mt-0.5', EVENT_COLOR[event.eventType]]"
      />
      <div class="flex-1 min-w-0">
        <p>{{ humanizeTaskEventType(event.eventType) }}</p>
        <p class="text-xs text-muted">{{ formatDateTime(event.createdAt) }}</p>
      </div>
    </li>
  </ol>
</template>