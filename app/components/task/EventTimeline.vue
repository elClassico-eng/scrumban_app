<script setup lang="ts">
import type { TaskEvent } from '#shared/types/task'
import type { TaskEventType } from '#shared/types/domain'

const props = defineProps<{ events: TaskEvent[]; workspaceId: string }>()

const wsId = computed(() => props.workspaceId)
const { list: membersList } = useMembersApi(wsId)

const EVENT_ICON: Record<TaskEventType, string> = {
  task_created: 'i-lucide-plus-circle',
  task_moved: 'i-lucide-arrow-right-circle',
  task_closed: 'i-lucide-check-circle',
  task_reopened: 'i-lucide-rotate-ccw',
  task_assigned: 'i-lucide-user-check',
  task_updated: 'i-lucide-pencil',
  task_archived: 'i-lucide-archive',
  task_commented: 'i-lucide-message-square',
  task_comment_deleted: 'i-lucide-message-square-off',
  task_added_to_sprint: 'i-lucide-circle-plus',
  task_removed_from_sprint: 'i-lucide-circle-minus',
  task_blocked: 'i-lucide-octagon-x',
  task_unblocked: 'i-lucide-octagon',
}

const EVENT_COLOR: Record<TaskEventType, string> = {
  task_created: 'text-info',
  task_moved: 'text-primary',
  task_closed: 'text-success',
  task_reopened: 'text-warning',
  task_assigned: 'text-info',
  task_updated: 'text-muted',
  task_archived: 'text-muted',
  task_commented: 'text-info',
  task_comment_deleted: 'text-muted',
  task_added_to_sprint: 'text-muted',
  task_removed_from_sprint: 'text-muted',
  task_blocked: 'text-red-500',
  task_unblocked: 'text-emerald-600',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function actorName(actorId: string | null): string {
  if (actorId == null) return 'удалённый пользователь'
  const found = membersList.data.value?.members.find(m => m.userId === actorId)
  return found ? displayName(found) : 'неизвестный пользователь'
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
        <p>
          <span class="font-medium">{{ actorName(event.actorId) }}</span>
          <span class="text-muted"> — </span>
          <span>{{ humanizeTaskEventType(event.eventType).toLowerCase() }}</span>
        </p>
        <p class="text-xs text-muted">{{ formatDateTime(event.createdAt) }}</p>
      </div>
    </li>
  </ol>
</template>
