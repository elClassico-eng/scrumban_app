<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { MotionConfig } from 'motion-v'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AssignedComment } from '#shared/types/comment'
import type { Notification, NotificationType } from '#shared/types/notification'
import type { InboxView } from '#shared/utils/notification-category'
import { apiRoutes } from '~/routing'
import { inboxGroupKey, inboxRow, renderNotification } from '~/utils/notification-render'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.id as string)
useWorkspaceStore().setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const workspace = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === wsId.value))
useHead({ title: () => (workspace.value ? `${workspace.value.name} – Входящие` : 'Входящие – Такт') })

type PrimaryFilter = 'all' | 'mentions' | 'replies' | 'assigned_tasks' | 'assigned_comments'
const FILTER_TYPES: Record<Exclude<PrimaryFilter, 'assigned_comments'>, NotificationType[] | undefined> = {
  all: undefined,
  mentions: ['mention'],
  replies: ['reply'],
  assigned_tasks: ['assigned', 'comment_on_assigned'],
}
const FILTERS: Record<PrimaryFilter, { label: string, icon: string }> = {
  all: { label: 'Все', icon: 'i-hugeicons-inbox' },
  mentions: { label: 'Упоминания', icon: 'i-hugeicons-at-sign' },
  replies: { label: 'Ответы', icon: 'i-hugeicons-message-square-reply' },
  assigned_tasks: { label: 'Мои задачи', icon: 'i-hugeicons-user-check-01' },
  assigned_comments: { label: 'Поручения', icon: 'i-hugeicons-message-user-01' },
}

const view = ref<InboxView>('primary')
const primaryFilter = ref<PrimaryFilter>('all')
const unreadOnly = ref(false)
const showAssigned = computed(() => view.value === 'primary' && primaryFilter.value === 'assigned_comments')

const filter = computed(() => ({
  view: view.value,
  types: view.value === 'primary' && primaryFilter.value !== 'assigned_comments' ? FILTER_TYPES[primaryFilter.value] : undefined,
  unreadOnly: (view.value === 'primary' || view.value === 'flow') && unreadOnly.value,
}))

const { feed, counts, assigned, update, clearAll } = useInboxApi(wsId, filter)
const { list: boardsList } = useBoardsApi(wsId)
const boards = computed(() => new Map((boardsList.data.value?.boards ?? []).map(b => [b.id, b])))
const assignedItems = computed(() => assigned.data.value?.comments ?? [])

function unreadLabel(n: number | undefined): string {
  if (!n) return 'всё прочитано'
  return `${n > 99 ? '99+' : n} непрочит.`
}

const tabs = computed(() => [
  { value: 'primary' as const, label: 'Основное', icon: 'i-hugeicons-inbox', sub: unreadLabel((counts.data.value?.primary ?? 0) + assignedItems.value.length) },
  { value: 'flow' as const, label: 'Поток', icon: 'i-hugeicons-activity-01', sub: unreadLabel(counts.data.value?.flow) },
  { value: 'later' as const, label: 'Позже', icon: 'i-hugeicons-clock-01', sub: counts.data.value?.later ? `${counts.data.value.later} отложено` : '' },
  { value: 'cleared' as const, label: 'Разобрано', icon: 'i-hugeicons-tick-double-02', sub: '' },
])

const filterItems = computed<DropdownMenuItem[][]>(() => [
  (Object.keys(FILTERS) as PrimaryFilter[]).map(f => ({
    label: f === 'assigned_comments' && assignedItems.value.length ? `${FILTERS[f].label} · ${assignedItems.value.length}` : FILTERS[f].label,
    icon: FILTERS[f].icon,
    current: primaryFilter.value === f,
    onSelect: () => { primaryFilter.value = f },
  })),
])

const TAB_ORDER: InboxView[] = ['primary', 'flow', 'later', 'cleared']
const direction = ref(1)
watch(view, (next, prev) => {
  direction.value = TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(prev) ? 1 : -1
})
const listKey = computed(() => `${view.value}:${primaryFilter.value}:${unreadOnly.value}`)

type Row = {
  key: string
  latest: Notification
  ids: string[]
  count: number
  unread: boolean
}

const rows = computed<Row[]>(() => {
  const byKey = new Map<string, Row>()
  for (const n of feed.data.value?.pages.flatMap(p => p.notifications) ?? []) {
    const key = inboxGroupKey(n)
    const row = byKey.get(key)
    if (row) {
      row.ids.push(n.id)
      row.count++
      row.unread ||= !n.readAt
    }
    else {
      byKey.set(key, { key, latest: n, ids: [n.id], count: 1, unread: !n.readAt })
    }
  }
  return [...byKey.values()]
})

function bucketOf(iso: string): string {
  const d = new Date(iso).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = today.getTime()
  if (d >= t) return 'Сегодня'
  if (d >= t - 86_400_000) return 'Вчера'
  if (d >= t - 7 * 86_400_000) return 'За неделю'
  return 'Ранее'
}

const groups = computed(() => {
  const out: { label: string, offset: number, rows: Row[] }[] = []
  rows.value.forEach((r, i) => {
    const label = bucketOf(r.latest.createdAt)
    const last = out.at(-1)
    if (last?.label === label) last.rows.push(r)
    else out.push({ label, offset: i, rows: [r] })
  })
  return out
})

function timeOf(iso: string): string {
  const d = new Date(iso)
  const bucket = bucketOf(iso)
  return bucket === 'Сегодня' || bucket === 'Вчера'
    ? d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function boardOf(payload: Record<string, unknown>) {
  return boards.value.get(String(payload.boardId ?? '')) ?? null
}

async function openRow(r: Row) {
  if (r.unread) update.mutate({ ids: r.ids, read: true })
  const { taskId, boardId } = r.latest.payload
  if (typeof taskId === 'string' && typeof boardId === 'string') return openTask(boardId, taskId)
  const target = renderNotification(r.latest).target
  if (target) await router.push(target)
}

const { taskId: modalTaskId, boardId: modalBoardId, open: modalOpen, openTask } = useTaskModalQuery()

const qc = useQueryClient()
const toast = useToast()
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

const EMPTY: Record<InboxView, { title: string, hint: string }> = {
  primary: { title: 'Всё разобрано', hint: 'Здесь появятся упоминания, ответы, поручения и назначения.' },
  flow: { title: 'Поток спокоен', hint: 'Сюда приходят сигналы о потоке: SLE, WIP, пополнение бэклога, прогноз спринта.' },
  later: { title: 'Ничего не отложено', hint: 'Отложенное вернётся во входящие в выбранное время.' },
  cleared: { title: 'Пока пусто', hint: 'Разобранное хранится здесь, его можно вернуть.' },
}
</script>

<template>
  <MotionConfig reduced-motion="user">
  <div class="space-y-5">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Входящие</h1>
      <p class="mt-1 text-sm text-muted">Что касается вас в этом воркспейсе: разберите и двигайтесь дальше</p>
    </div>

    <UiUnderlineTabs v-model="view" :items="tabs" label="Разделы входящих" indicator-id="inbox-tab" />

    <div class="flex flex-wrap items-center gap-2">
      <UDropdownMenu v-if="view === 'primary'" :items="filterItems" :ui="{ content: 'w-52' }">
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          :icon="primaryFilter === 'all' ? 'i-hugeicons-filter-horizontal' : FILTERS[primaryFilter].icon"
        >
          {{ primaryFilter === 'all' ? 'Фильтр' : FILTERS[primaryFilter].label }}
        </UButton>
        <template #item-trailing="{ item }">
          <UIcon v-if="item.current" name="i-hugeicons-check" class="size-4 text-accent-600 dark:text-accent-400" />
        </template>
      </UDropdownMenu>
      <USwitch
        v-if="(view === 'primary' || view === 'flow') && !showAssigned"
        v-model="unreadOnly"
        label="Только непрочитанные"
        size="sm"
      />
      <div class="flex-1" />
      <UButton
        v-if="(view === 'primary' || view === 'flow') && !showAssigned && rows.length"
        size="sm"
        color="neutral"
        variant="outline"
        icon="i-hugeicons-tick-double-02"
        :loading="clearAll.isPending.value"
        @click="clearAll.mutate(view as 'primary' | 'flow')"
      >
        Разобрать всё
      </UButton>
    </div>

    <Transition
      mode="out-in"
      enter-active-class="transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none"
      leave-active-class="transition-[opacity,translate] duration-100 ease-in motion-reduce:transition-none"
      :enter-from-class="direction > 0 ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'"
      :leave-to-class="direction > 0 ? 'opacity-0 -translate-x-4' : 'opacity-0 translate-x-4'"
    >
      <div :key="listKey">
    <template v-if="showAssigned">
      <div v-if="!assignedItems.length" class="space-y-2 rounded-3xl border border-dashed border-default py-16 text-center">
        <UIcon name="i-hugeicons-message-user-01" class="mx-auto size-10 text-muted" />
        <p class="font-medium">Поручений нет</p>
        <p class="text-sm text-muted">Когда вам поручат комментарий, он будет здесь до отметки «Выполнено».</p>
      </div>
      <div v-else class="surface overflow-hidden rounded-2xl divide-y divide-default">
        <InboxItem
          v-for="(c, i) in assignedItems"
          :key="c.id"
          class="inbox-row-in"
          :style="{ '--i': Math.min(i, 14) }"
          :subject="c.taskTitle"
          label="поручение"
          :detail="c.body"
          :actor="c.author"
          icon="i-hugeicons-message-user-01"
          color="#2e6df5"
          :board="boards.get(c.boardId) ?? null"
          :count="1"
          unread
          :time="timeOf(c.createdAt)"
          view="assigned"
          @open="openTask(c.boardId, c.taskId)"
          @resolve="resolve.mutate(c)"
        />
      </div>
    </template>

    <template v-else>
      <div v-if="feed.isLoading.value" class="py-12 text-center text-muted">
        <UIcon name="i-hugeicons-loader" class="size-6 animate-spin" />
      </div>
      <div v-else-if="!rows.length" class="space-y-2 rounded-3xl border border-dashed border-default py-16 text-center">
        <UIcon :name="tabs.find(t => t.value === view)!.icon" class="mx-auto size-10 text-muted" />
        <p class="font-medium">{{ EMPTY[view].title }}</p>
        <p class="text-sm text-muted">{{ EMPTY[view].hint }}</p>
      </div>
      <div v-else class="space-y-5">
        <section v-for="g in groups" :key="g.label">
          <p class="mb-2 px-1 text-sm font-semibold text-highlighted">{{ g.label }}</p>
          <TransitionGroup
            tag="div"
            class="surface relative overflow-hidden rounded-2xl divide-y divide-default"
            leave-active-class="transition-all duration-200 ease-in motion-reduce:transition-none"
            leave-to-class="opacity-0 -translate-x-6"
            move-class="transition-transform duration-200 ease-out motion-reduce:transition-none"
          >
            <InboxItem
              v-for="(r, i) in g.rows"
              :key="r.key"
              class="inbox-row-in"
              :style="{ '--i': Math.min(g.offset + i, 14) }"
              v-bind="inboxRow(r.latest)"
              :actor="r.latest.actor ?? null"
              :icon="renderNotification(r.latest).icon"
              :color="renderNotification(r.latest).color"
              :board="boardOf(r.latest.payload)"
              :count="r.count"
              :unread="r.unread"
              :time="timeOf(r.latest.createdAt)"
              :view="view"
              :snoozed-until="r.latest.snoozedUntil"
              @open="openRow(r)"
              @toggle-read="update.mutate({ ids: r.ids, read: r.unread })"
              @snooze="(until: string) => update.mutate({ ids: r.ids, snoozedUntil: until })"
              @clear="update.mutate({ ids: r.ids, cleared: true })"
              @restore="update.mutate(view === 'later' ? { ids: r.ids, snoozedUntil: null } : { ids: r.ids, cleared: false })"
            />
          </TransitionGroup>
        </section>
        <div v-if="feed.hasNextPage.value" class="text-center">
          <UButton color="neutral" variant="ghost" size="sm" :loading="feed.isFetchingNextPage.value" @click="feed.fetchNextPage()">
            Показать ещё
          </UButton>
        </div>
      </div>
    </template>
      </div>
    </Transition>
    <TaskFocusModal
      v-if="modalBoardId"
      v-model:open="modalOpen"
      :workspace-id="wsId"
      :board-id="modalBoardId"
      :task-id="modalTaskId"
    />
  </div>
  </MotionConfig>
</template>
