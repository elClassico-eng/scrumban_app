<script setup lang="ts">
import type { Notification } from '#shared/types/notification'
import { renderNotification } from '~/utils/notification-render'

const { list, unreadCount, markRead, markAllRead } = useNotificationsApi()
const router = useRouter()

const open = ref(false)

const items = computed(() => list.data.value?.notifications ?? [])
const count = computed(() => unreadCount.data.value?.count ?? 0)

async function onClick(n: Notification) {
  const target = renderNotification(n).target
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
            :name="renderNotification(n).icon"
            class="size-4 mt-1 shrink-0"
            :class="!n.readAt ? 'text-primary' : 'text-muted'"
          />
          <div class="flex-1 min-w-0 space-y-0.5">
            <p class="text-sm font-medium" :class="!n.readAt ? '' : 'text-muted'">
              {{ renderNotification(n).title }}
            </p>
            <p v-if="renderNotification(n).why" class="text-xs text-muted">
              {{ renderNotification(n).why }}
            </p>
            <p class="text-[11px] text-muted flex items-center gap-2">
              <span>{{ formatRelativeDate(n.createdAt) }}</span>
              <span v-if="renderNotification(n).target" class="font-medium text-primary">{{ renderNotification(n).cta }} →</span>
            </p>
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