<script setup lang="ts">
import type { Task } from '#shared/types/task'
import { pageRoutes } from '~/routing'
import { dueLocalDay } from '~/utils/calendar'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
useWorkspaceStore().setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const workspace = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === wsId.value))
useHead({ title: () => (workspace.value ? `${workspace.value.name} – Мои задачи` : 'Мои задачи – Такт') })

const { list } = useWorkspaceTasksApi(wsId, { mine: true })
const { list: boardsList } = useBoardsApi(wsId)
const boards = computed(() => new Map((boardsList.data.value?.boards ?? []).map(b => [b.id, b])))

const showClosed = ref(false)
const WEEK_MS = 7 * 86_400_000

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'closed'
const BUCKETS: { id: Bucket, label: string }[] = [
  { id: 'overdue', label: 'Просрочено' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'На этой неделе' },
  { id: 'later', label: 'Позже' },
  { id: 'none', label: 'Без срока' },
  { id: 'closed', label: 'Закрыто за неделю' },
]
const CLASS_RANK = { expedite: 0, fixed_date: 1, standard: 2, intangible: 3 } as const

function dayDiff(t: Task): number | null {
  if (!t.dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((dueLocalDay(t.dueDate).getTime() - today.getTime()) / 86_400_000)
}

function bucketOf(t: Task): Bucket {
  if (t.closedAt) return 'closed'
  const diff = dayDiff(t)
  if (diff === null) return 'none'
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'week'
  return 'later'
}

const tasks = computed(() => (list.data.value?.tasks ?? []).filter(t =>
  !t.closedAt || (showClosed.value && Date.now() - new Date(t.closedAt).getTime() < WEEK_MS),
))

const groups = computed(() => BUCKETS
  .map(b => ({
    ...b,
    items: tasks.value
      .filter(t => bucketOf(t) === b.id)
      .sort((a, c) =>
        (dayDiff(a) ?? 0) - (dayDiff(c) ?? 0)
        || CLASS_RANK[a.serviceClass] - CLASS_RANK[c.serviceClass]
        || new Date(a.createdAt).getTime() - new Date(c.createdAt).getTime()),
  }))
  .filter(g => g.items.length))

const openCount = computed(() => tasks.value.filter(t => !t.closedAt).length)

function dueLabel(t: Task): string {
  const diff = dayDiff(t)
  if (diff === null || !t.dueDate) return ''
  if (diff === 0) return 'сегодня'
  if (diff === 1) return 'завтра'
  if (diff < 0) return `${-diff} дн назад`
  return dueLocalDay(t.dueDate).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Мои задачи</h1>
        <p class="mt-1 text-sm text-muted">
          {{ openCount }} открытых по всем доскам воркспейса
        </p>
      </div>
      <USwitch v-model="showClosed" label="Закрытые за неделю" size="sm" />
    </div>

    <div v-if="list.isLoading.value" class="py-12 text-center text-muted">
      <UIcon name="i-hugeicons-loader" class="size-6 animate-spin" />
    </div>
    <div
      v-else-if="!groups.length"
      class="space-y-2 rounded-3xl border border-dashed border-default py-16 text-center"
    >
      <UIcon name="i-hugeicons-task-done-01" class="mx-auto size-10 text-muted" />
      <p class="font-medium">На вас ничего не висит</p>
      <p class="text-sm text-muted">Задачи, где вы исполнитель, соберутся здесь со всех досок.</p>
    </div>

    <section v-for="g in groups" :key="g.id">
      <p
        :class="[
          'mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider',
          g.id === 'overdue' ? 'text-error' : 'text-dimmed',
        ]"
      >
        {{ g.label }}
        <span class="font-normal">{{ g.items.length }}</span>
      </p>
      <ul class="surface divide-y divide-default overflow-hidden rounded-2xl">
        <li v-for="t in g.items" :key="t.id">
          <NuxtLink
            :to="pageRoutes.task(wsId, t.boardId, t.id)"
            class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated"
          >
            <span
              class="grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
              :style="{ background: boards.get(t.boardId)?.color ?? '#94a3b8' }"
              :title="boards.get(t.boardId)?.name"
            >{{ boards.get(t.boardId)?.name.trim().charAt(0).toUpperCase() ?? '·' }}</span>
            <span :class="['min-w-0 flex-1 truncate text-sm', t.closedAt ? 'text-muted line-through' : 'font-medium text-default']">
              {{ t.title }}
            </span>
            <UIcon v-if="t.serviceClass === 'expedite'" name="i-hugeicons-zap" class="size-4 shrink-0 text-error" title="Срочная" />
            <UIcon v-if="t.blockedSince" name="i-hugeicons-octagon-x" class="size-4 shrink-0 text-warning" title="Есть блокер" />
            <span
              v-if="t.dueDate && !t.closedAt"
              :class="['shrink-0 text-xs', g.id === 'overdue' ? 'font-semibold text-error' : 'text-muted']"
            >{{ dueLabel(t) }}</span>
            <span class="hidden w-28 shrink-0 truncate text-right text-xs text-dimmed sm:block">
              {{ boards.get(t.boardId)?.name }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
