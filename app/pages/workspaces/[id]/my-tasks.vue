<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { MotionConfig } from 'motion-v'
import type { ColumnRole } from '#shared/types/column'
import type { Task } from '#shared/types/task'
import { COLUMN_ROLE_INFO } from '~/utils/column-role'
import { dueInfo } from '~/utils/due'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
useWorkspaceStore().setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const workspace = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === wsId.value))
useHead({ title: () => (workspace.value ? `${workspace.value.name} – Мои задачи` : 'Мои задачи – Такт') })

const { list } = useWorkspaceTasksApi(wsId, { mine: true })
const { list: boardsList } = useBoardsApi(wsId)
const columnsQuery = useWorkspaceColumnsApi(wsId)

const boards = computed(() => new Map((boardsList.data.value?.boards ?? []).map(b => [b.id, b])))
const columns = computed(() => new Map((columnsQuery.data.value?.columns ?? []).map(c => [c.id, c])))
const { taskId: modalTaskId, boardId: modalBoardId, open: modalOpen, openTask } = useTaskModalQuery()

const DONE_WINDOW_DAYS = 30
const all = computed(() => list.data.value?.tasks ?? [])
const active = computed(() => all.value.filter(t => !t.closedAt))
const done = computed(() => all.value
  .filter(t => t.closedAt && Date.now() - new Date(t.closedAt).getTime() < DONE_WINDOW_DAYS * 86_400_000)
  .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime()))

type Tab = 'active' | 'done'
const tab = ref<Tab>('active')
const tabs = computed(() => [
  { value: 'active' as const, label: 'В работе', icon: 'i-hugeicons-task-01', sub: `${active.value.length} открыто` },
  { value: 'done' as const, label: 'Сделано', icon: 'i-hugeicons-task-done-01', sub: `${done.value.length} за ${DONE_WINDOW_DAYS} дн` },
])

type Quick = 'all' | 'overdue' | 'today' | 'blocked' | 'expedite'
const QUICK: { value: Quick, label: string, icon: string, test: (t: Task) => boolean }[] = [
  { value: 'all', label: 'Все', icon: 'i-hugeicons-task-01', test: () => true },
  { value: 'overdue', label: 'Просрочено', icon: 'i-hugeicons-alert-circle', test: t => dueInfo(t.dueDate)?.tone === 'overdue' },
  { value: 'today', label: 'Сегодня', icon: 'i-hugeicons-calendar-03', test: t => dueInfo(t.dueDate)?.tone === 'today' },
  { value: 'blocked', label: 'С блокером', icon: 'i-hugeicons-octagon-x', test: t => !!t.blockedSince },
  { value: 'expedite', label: 'Срочные', icon: 'i-hugeicons-zap', test: t => t.serviceClass === 'expedite' },
]
const quick = ref<Quick>('all')
const quickItems = computed(() => QUICK.map(q => ({ ...q, count: active.value.filter(q.test).length })))

type GroupBy = 'due' | 'status' | 'board'
const GROUP_BY: Record<GroupBy, { label: string, icon: string }> = {
  due: { label: 'По сроку', icon: 'i-hugeicons-calendar-03' },
  status: { label: 'По статусу', icon: 'i-hugeicons-square-kanban' },
  board: { label: 'По доске', icon: 'i-hugeicons-layout-grid' },
}
const groupBy = ref<GroupBy>('due')
const groupItems = computed<DropdownMenuItem[][]>(() => [
  (Object.keys(GROUP_BY) as GroupBy[]).map(g => ({
    label: GROUP_BY[g].label,
    icon: GROUP_BY[g].icon,
    current: groupBy.value === g,
    onSelect: () => { groupBy.value = g },
  })),
])

const CLASS_RANK = { expedite: 0, fixed_date: 1, standard: 2, intangible: 3 } as const
const DUE_BUCKETS = ['Просрочено', 'Сегодня', 'На этой неделе', 'Позже', 'Без срока'] as const
const ROLE_ORDER: ColumnRole[] = ['in_progress', 'review', 'backlog', 'done', 'archived']

function dueBucket(t: Task): (typeof DUE_BUCKETS)[number] {
  const d = dueInfo(t.dueDate)
  if (!d) return 'Без срока'
  if (d.tone === 'overdue') return 'Просрочено'
  if (d.tone === 'today') return 'Сегодня'
  return d.diff <= 7 ? 'На этой неделе' : 'Позже'
}

function byUrgency(a: Task, b: Task): number {
  return (dueInfo(a.dueDate)?.diff ?? 1e9) - (dueInfo(b.dueDate)?.diff ?? 1e9)
    || CLASS_RANK[a.serviceClass] - CLASS_RANK[b.serviceClass]
    || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function closedBucket(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(iso).getTime()
  if (d >= today.getTime()) return 'Сегодня'
  if (d >= today.getTime() - 86_400_000) return 'Вчера'
  if (d >= today.getTime() - 7 * 86_400_000) return 'За неделю'
  return 'Ранее'
}

type Group = { key: string, label: string, tone?: 'danger', offset: number, tasks: Task[] }

function pack(entries: [string, string, Task[]][], tones: Record<string, 'danger'> = {}): Group[] {
  let offset = 0
  return entries
    .filter(([, , tasks]) => tasks.length)
    .map(([key, label, tasks]) => {
      const g = { key, label, tone: tones[key], offset, tasks }
      offset += tasks.length
      return g
    })
}

const groups = computed<Group[]>(() => {
  if (tab.value === 'done') {
    const buckets = new Map<string, Task[]>()
    for (const t of done.value) buckets.set(closedBucket(t.closedAt!), [...(buckets.get(closedBucket(t.closedAt!)) ?? []), t])
    return pack([...buckets].map(([label, tasks]) => [label, label, tasks]))
  }
  const test = QUICK.find(q => q.value === quick.value)!.test
  const items = active.value.filter(test).sort(byUrgency)
  if (groupBy.value === 'status') {
    return pack(ROLE_ORDER.map(role => [
      role,
      COLUMN_ROLE_INFO[role].short,
      items.filter(t => columns.value.get(t.columnId)?.columnRole === role),
    ]))
  }
  if (groupBy.value === 'board') {
    const ids = [...new Set(items.map(t => t.boardId))]
    return pack(ids.map(id => [id, boards.value.get(id)?.name ?? 'Доска', items.filter(t => t.boardId === id)]))
  }
  return pack(DUE_BUCKETS.map(b => [b, b, items.filter(t => dueBucket(t) === b)]), { Просрочено: 'danger' })
})

const direction = ref(1)
watch(tab, (next) => { direction.value = next === 'done' ? 1 : -1 })
const listKey = computed(() => `${tab.value}:${quick.value}:${groupBy.value}`)

const EMPTY: Record<Tab, { title: string, hint: string }> = {
  active: { title: 'На вас ничего не висит', hint: 'Задачи, где вы исполнитель, соберутся здесь со всех досок воркспейса.' },
  done: { title: 'Пока ничего не закрыто', hint: `Здесь будут задачи, закрытые за последние ${DONE_WINDOW_DAYS} дней.` },
}
</script>

<template>
  <MotionConfig reduced-motion="user">
    <div class="space-y-5">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Мои задачи</h1>
        <p class="mt-1 text-sm text-muted">Всё, где вы исполнитель, по всем доскам: что горит, что в работе, что уже сделано</p>
      </div>

      <UiUnderlineTabs v-model="tab" :items="tabs" label="Разделы моих задач" indicator-id="my-tasks-tab" />

      <div v-if="tab === 'active'" class="flex flex-wrap items-center gap-2">
        <div class="flex flex-wrap items-center gap-1 rounded-xl bg-elevated p-1">
          <button
            v-for="q in quickItems"
            :key="q.value"
            type="button"
            :class="[
              'flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm transition-colors',
              quick === q.value ? 'bg-default text-highlighted shadow-xs' : 'text-muted hover:text-default',
            ]"
            @click="quick = q.value"
          >
            <UIcon :name="q.icon" :class="['size-4', q.value === 'overdue' && q.count ? 'text-error' : '']" />
            {{ q.label }}
            <span class="text-xs tabular-nums text-dimmed">{{ q.count }}</span>
          </button>
        </div>
        <div class="flex-1" />
        <UDropdownMenu :items="groupItems" :content="{ align: 'end' }" :ui="{ content: 'w-48' }">
          <UButton size="sm" color="neutral" variant="outline" :icon="GROUP_BY[groupBy].icon">
            {{ GROUP_BY[groupBy].label }}
          </UButton>
          <template #item-trailing="{ item }">
            <UIcon v-if="item.current" name="i-hugeicons-check" class="size-4 text-accent-600 dark:text-accent-400" />
          </template>
        </UDropdownMenu>
      </div>

      <div v-if="list.isLoading.value" class="py-12 text-center text-muted">
        <UIcon name="i-hugeicons-loader" class="size-6 animate-spin" />
      </div>

      <Transition
        v-else
        mode="out-in"
        enter-active-class="transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none"
        leave-active-class="transition-[opacity,translate] duration-100 ease-in motion-reduce:transition-none"
        :enter-from-class="direction > 0 ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'"
        :leave-to-class="direction > 0 ? 'opacity-0 -translate-x-4' : 'opacity-0 translate-x-4'"
      >
        <div :key="listKey">
          <div v-if="!groups.length" class="space-y-2 rounded-3xl border border-dashed border-default py-16 text-center">
            <UIcon :name="tab === 'active' ? 'i-hugeicons-task-done-01' : 'i-hugeicons-task-01'" class="mx-auto size-10 text-muted" />
            <p class="font-medium">{{ quick === 'all' || tab === 'done' ? EMPTY[tab].title : 'Под фильтр ничего не попало' }}</p>
            <p class="text-sm text-muted">{{ quick === 'all' || tab === 'done' ? EMPTY[tab].hint : 'Попробуйте другой фильтр.' }}</p>
          </div>
          <div v-else class="space-y-5">
            <section v-for="g in groups" :key="g.key">
              <p :class="['mb-2 flex items-center gap-2 px-1 text-sm font-semibold', g.tone === 'danger' ? 'text-error' : 'text-highlighted']">
                {{ g.label }}
                <span class="text-xs font-normal text-dimmed">{{ g.tasks.length }}</span>
              </p>
              <div class="surface overflow-hidden rounded-2xl divide-y divide-default">
                <MyTasksRow
                  v-for="(t, i) in g.tasks"
                  :key="t.id"
                  class="inbox-row-in"
                  :style="{ '--i': Math.min(g.offset + i, 14) }"
                  :task="t"
                  :board="boards.get(t.boardId) ?? null"
                  :column="columns.get(t.columnId) ?? null"
                  @open="openTask(t.boardId, t.id)"
                />
              </div>
            </section>
          </div>
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
