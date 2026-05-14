<script setup lang="ts">
import type { Notification, NotificationType } from '#shared/types/notification'
import { pageRoutes } from '~/routing'

const { list, unreadCount, markRead, markAllRead } = useNotificationsApi()
const router = useRouter()

const open = ref(false)

const items = computed(() => list.data.value?.notifications ?? [])
const count = computed(() => unreadCount.data.value?.count ?? 0)

const ICON: Record<NotificationType, string> = {
  mention: 'i-lucide-at-sign',
  assigned: 'i-lucide-user-check',
  comment_on_assigned: 'i-lucide-message-square',
  sle_breach: 'i-lucide-alert-triangle',
  replenishment_overdue: 'i-lucide-refresh-cw',
  sprint_forecast_drop: 'i-lucide-trending-down',
}

const TITLE: Record<NotificationType, string> = {
  mention: 'Упомянули в комментарии',
  assigned: 'Назначили задачу',
  comment_on_assigned: 'Прокомментировали вашу задачу',
  sle_breach: 'Задача застряла дольше SLE',
  replenishment_overdue: 'Пора провести Replenishment',
  sprint_forecast_drop: 'Прогноз спринта упал',
}

function getDescription(n: Notification): string {
  const p = n.payload as Record<string, string>
  switch (n.type) {
    case 'mention':
    case 'comment_on_assigned':
      return p.taskTitle ?? ''
    case 'assigned':
      return p.taskTitle ?? ''
    case 'sle_breach':
      return p.taskTitle ?? ''
    case 'replenishment_overdue':
      return p.boardName ?? ''
    case 'sprint_forecast_drop':
      return p.sprintName ?? ''
  }
}

function getTarget(n: Notification): ReturnType<typeof pageRoutes.task> | string | null {
  const p = n.payload as Record<string, string>
  switch (n.type) {
    case 'mention':
    case 'assigned':
    case 'comment_on_assigned':
    case 'sle_breach':
      return p.taskId && p.boardId
        ? pageRoutes.task(n.workspaceId, p.boardId, p.taskId)
        : null
    case 'replenishment_overdue':
      return p.boardId ? pageRoutes.board(n.workspaceId, p.boardId) : null
    case 'sprint_forecast_drop':
      return p.boardId ? pageRoutes.boardSprints(n.workspaceId, p.boardId) : null
  }
}

async function onClick(n: Notification) {
  const target = getTarget(n)
  if (!n.readAt) markRead.mutate(n.id)
  open.value = false
  if (target) await router.push(target)
}

function onMarkAll() {
  markAllRead.mutate(undefined)
}
</script>

<template>
  <UButton
    icon="i-lucide-bell"
    color="neutral"
    variant="ghost"
    size="sm"
    class="relative"
    title="Уведомления"
    @click="open = true"
  >
    <span
      v-if="count > 0"
      class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center"
    >
      {{ count > 99 ? '99+' : count }}
    </span>
  </UButton>

  <USlideover
    v-model:open="open"
    side="right"
    title="Уведомления"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div class="space-y-1 -mx-4">
        <div
          v-if="items.length > 0"
          class="flex items-center justify-between px-4 pb-2 sticky top-0 bg-default z-10"
        >
          <span class="text-xs text-muted">
            {{ count > 0 ? `${count} непрочитанных` : 'Все прочитаны' }}
          </span>
          <UButton
            v-if="count > 0"
            size="xs"
            variant="ghost"
            color="neutral"
            :loading="markAllRead.isPending.value"
            @click="onMarkAll"
          >
            Прочитать все
          </UButton>
        </div>

        <button
          v-for="n in items"
          :key="n.id"
          type="button"
          class="w-full flex gap-3 px-4 py-3 text-left hover:bg-elevated/60 transition-colors"
          :class="!n.readAt ? 'bg-primary/5' : ''"
          @click="onClick(n)"
        >
          <UIcon
            :name="ICON[n.type]"
            class="size-4 mt-1 shrink-0"
            :class="!n.readAt ? 'text-primary' : 'text-muted'"
          />
          <div class="flex-1 min-w-0 space-y-0.5">
            <p class="text-sm font-medium" :class="!n.readAt ? '' : 'text-muted'">
              {{ TITLE[n.type] }}
            </p>
            <p v-if="getDescription(n)" class="text-xs text-muted truncate">
              {{ getDescription(n) }}
            </p>
            <p class="text-[11px] text-muted">{{ formatRelativeDate(n.createdAt) }}</p>
          </div>
          <span
            v-if="!n.readAt"
            class="size-2 mt-2 rounded-full bg-primary shrink-0"
          />
        </button>

        <div v-if="items.length === 0 && !list.isLoading.value" class="px-4 py-12 text-center space-y-2">
          <UIcon name="i-lucide-bell-off" class="size-10 mx-auto text-muted" />
          <p class="text-sm text-muted">Пока нет уведомлений</p>
        </div>
      </div>
    </template>
  </USlideover>
</template>