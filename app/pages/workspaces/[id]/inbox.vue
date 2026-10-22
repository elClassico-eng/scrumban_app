<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AssignedComment } from '#shared/types/comment'
import type { Notification, NotificationType } from '#shared/types/notification'
import { apiRoutes, pageRoutes } from '~/routing'
import { renderNotification, type RenderedNotification } from '~/utils/notification-render'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)
useWorkspaceStore().setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const workspace = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === wsId.value))
useHead({ title: () => (workspace.value ? `${workspace.value.name} – Inbox` : 'Inbox – Такт') })

type Tab = 'all' | 'mentions' | 'replies' | 'assigned'
const TAB_TYPES: Record<Exclude<Tab, 'assigned'>, NotificationType[] | undefined> = {
  all: undefined,
  mentions: ['mention'],
  replies: ['reply'],
}

const tab = ref<Tab>('all')
const unreadOnly = ref(false)
const filter = computed(() => ({
  types: tab.value === 'assigned' ? undefined : TAB_TYPES[tab.value],
  unreadOnly: unreadOnly.value,
}))

const { feed, unreadCount, assigned } = useInboxApi(wsId, filter)
const { markRead, markAllRead } = useNotificationsApi()
const qc = useQueryClient()
const toast = useToast()

const assignedItems = computed(() => assigned.data.value?.comments ?? [])
const tabs = computed(() => [
  { label: 'Все', value: 'all' },
  { label: 'Упоминания', value: 'mentions' },
  { label: 'Ответы', value: 'replies' },
  { label: 'Поручения', value: 'assigned', badge: assignedItems.value.length || undefined },
])

const notifications = computed(() => feed.data.value?.pages.flatMap(p => p.notifications) ?? [])

function dayBucket(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (d.getTime() >= startOfToday) return 'Сегодня'
  if (d.getTime() >= startOfToday - 86_400_000) return 'Вчера'
  return 'Ранее'
}

const groups = computed(() => {
  const out: { label: string, items: { n: Notification, r: RenderedNotification }[] }[] = []
  for (const n of notifications.value) {
    const label = dayBucket(n.createdAt)
    const item = { n, r: renderNotification(n) }
    const last = out.at(-1)
    if (last?.label === label) last.items.push(item)
    else out.push({ label, items: [item] })
  }
  return out
})

function timeOf(iso: string): string {
  const d = new Date(iso)
  return dayBucket(iso) === 'Ранее'
    ? d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
    : d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

async function open(n: Notification, target: RenderedNotification['target']) {
  if (!n.readAt) markRead.mutate(n.id)
  if (target) await router.push(target)
}

const resolve = useMutation({
  mutationFn: (c: AssignedComment) =>
    $fetch(apiRoutes.taskCommentAssignment(c.workspaceId, c.boardId, c.taskId, c.id), {
      method: 'PATCH',
      body: { resolved: true },
    }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['assigned-comments'] }),
  onError: (err) => {
    toast.add({ title: getErrorMessage(err, 'Не удалось закрыть поручение'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  },
})

function openAssigned(c: AssignedComment) {
  router.push(pageRoutes.task(c.workspaceId, c.boardId, c.taskId))
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Inbox</h1>
        <p class="mt-1 text-sm text-muted">
          Что произошло и касается вас в этом воркспейсе
        </p>
      </div>
      <UButton
        v-if="tab !== 'assigned' && (unreadCount.data.value?.count ?? 0) > 0"
        icon="i-hugeicons-check-check"
        size="sm"
        color="neutral"
        variant="outline"
        :loading="markAllRead.isPending.value"
        @click="markAllRead.mutate(wsId)"
      >
        Прочитать всё
      </UButton>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UTabs v-model="tab" :items="tabs" :content="false" size="sm" variant="pill" />
      <USwitch v-if="tab !== 'assigned'" v-model="unreadOnly" label="Только непрочитанные" size="sm" />
    </div>

    <template v-if="tab === 'assigned'">
      <div v-if="assigned.isLoading.value" class="py-12 text-center text-muted">
        <UIcon name="i-hugeicons-loader" class="size-6 animate-spin" />
      </div>
      <div
        v-else-if="!assignedItems.length"
        class="space-y-2 rounded-3xl border border-dashed border-default py-16 text-center"
      >
        <UIcon name="i-hugeicons-message-user-01" class="mx-auto size-10 text-muted" />
        <p class="font-medium">Поручений нет</p>
        <p class="text-sm text-muted">Когда вам поручат комментарий, он будет висеть здесь до отметки «Выполнено».</p>
      </div>
      <ul v-else class="surface divide-y divide-default overflow-hidden rounded-2xl">
        <li v-for="c in assignedItems" :key="c.id" class="flex items-start gap-3 px-4 py-3">
          <UserAvatar :user="c.author" size="sm" />
          <button type="button" class="min-w-0 flex-1 cursor-pointer text-left" @click="openAssigned(c)">
            <p class="truncate text-sm font-semibold text-highlighted">{{ c.taskTitle }}</p>
            <p class="mt-0.5 line-clamp-2 text-sm text-muted">
              <span class="font-medium text-default">{{ displayName(c.author) }}:</span>
              {{ deserializeMentions(c.body).text }}
            </p>
          </button>
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-hugeicons-checkmark-circle-02"
            :loading="resolve.isPending.value && resolve.variables.value?.id === c.id"
            @click="resolve.mutate(c)"
          >
            Выполнено
          </UButton>
        </li>
      </ul>
    </template>

    <template v-else>
      <div v-if="feed.isLoading.value" class="py-12 text-center text-muted">
        <UIcon name="i-hugeicons-loader" class="size-6 animate-spin" />
      </div>
      <div
        v-else-if="!notifications.length"
        class="space-y-2 rounded-3xl border border-dashed border-default py-16 text-center"
      >
        <UIcon name="i-hugeicons-inbox" class="mx-auto size-10 text-muted" />
        <p class="font-medium">{{ unreadOnly ? 'Всё прочитано' : 'Пока пусто' }}</p>
        <p class="text-sm text-muted">Здесь появятся упоминания, ответы, назначения и алерты потока.</p>
      </div>
      <div v-else class="space-y-5">
        <section v-for="g in groups" :key="g.label">
          <p class="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-dimmed">{{ g.label }}</p>
          <ul class="surface divide-y divide-default overflow-hidden rounded-2xl">
            <li v-for="{ n, r } in g.items" :key="n.id">
              <button
                type="button"
                class="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
                @click="open(n, r.target)"
              >
                <span
                  class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
                  :style="{ background: `${r.color}1a`, color: r.color }"
                >
                  <UIcon :name="r.icon" class="size-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span :class="['block truncate text-sm', n.readAt ? 'text-default' : 'font-semibold text-highlighted']">
                    {{ r.title }}
                  </span>
                  <span class="mt-0.5 block truncate text-sm text-muted">{{ r.why }}</span>
                  <span v-if="n.payload.snippet" class="mt-1 line-clamp-2 block text-sm text-toned">
                    {{ deserializeMentions(String(n.payload.snippet)).text }}
                  </span>
                </span>
                <span class="flex shrink-0 flex-col items-end gap-1.5">
                  <span class="text-xs text-dimmed">{{ timeOf(n.createdAt) }}</span>
                  <span v-if="!n.readAt" class="size-2 rounded-full bg-accent-500" />
                </span>
              </button>
            </li>
          </ul>
        </section>
        <div v-if="feed.hasNextPage.value" class="text-center">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="feed.isFetchingNextPage.value"
            @click="feed.fetchNextPage()"
          >
            Показать ещё
          </UButton>
        </div>
      </div>
    </template>
  </div>
</template>
