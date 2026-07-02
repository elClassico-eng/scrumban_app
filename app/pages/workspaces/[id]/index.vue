<script setup lang="ts">
import type { ActivityEvent } from '#shared/types/activity'
import { pageRoutes } from '~/routing'

const route = useRoute()
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const wsId = computed(() => route.params.id as string)

workspaceStore.setCurrent(wsId.value)

const { list: wsList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { list: tasksList } = useWorkspaceTasksApi(wsId)
const { list: membersList } = useMembersApi(wsId)
const { list: activityList } = useActivityApi(wsId, ref({}))

const workspace = computed(() => wsList.data.value?.workspaces.find(w => w.id === wsId.value))
const tasks = computed(() => tasksList.data.value?.tasks ?? [])
const boards = computed(() => boardsList.data.value?.boards ?? [])
const members = computed(() => membersList.data.value?.members ?? [])
const events = computed<ActivityEvent[]>(() => activityList.data.value?.events.slice(0, 6) ?? [])

useHead({
  title: () => workspace.value ? `${workspace.value.name} — Обзор` : 'Обзор — Такт',
})

const loading = computed(() => tasksList.isLoading.value || boardsList.isLoading.value)
const isEmpty = computed(() => !loading.value && boards.value.length === 0 && tasks.value.length === 0)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
})
const firstName = computed(() => {
  const u = authStore.user
  return u?.firstName?.trim() || displayName({ firstName: u?.firstName, lastName: u?.lastName, email: u?.email ?? '' })
})

const openTasks = computed(() => tasks.value.filter(t => !t.closedAt).length)
const doneTasks = computed(() => tasks.value.filter(t => t.closedAt).length)
const inProgress = computed(() => tasks.value.filter(t => !t.closedAt && !t.blockedReason).length)
const overdue = computed(() =>
  tasks.value.filter(t => !t.closedAt && t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length,
)
const blockedCount = computed(() => tasks.value.filter(t => !t.closedAt && t.blockedReason).length)

const donutSegments = computed(() =>
  [
    { name: 'Выполнено', value: doneTasks.value, color: '#22c55e' },
    { name: 'В работе', value: inProgress.value, color: '#e85002' },
    { name: 'Заблокировано', value: blockedCount.value, color: '#ef4444' },
  ].filter(s => s.value > 0),
)

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const offset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - offset)
  return x
}

const throughput = computed(() => {
  const base = startOfWeek(new Date())
  const weeks: { key: number; label: string; value: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(base)
    ws.setDate(ws.getDate() - i * 7)
    const label = `${String(ws.getDate()).padStart(2, '0')}.${String(ws.getMonth() + 1).padStart(2, '0')}`
    weeks.push({ key: ws.getTime(), label, value: 0 })
  }
  const byKey = new Map(weeks.map(w => [w.key, w]))
  for (const t of tasks.value) {
    if (!t.closedAt) continue
    const w = byKey.get(startOfWeek(new Date(t.closedAt)).getTime())
    if (w) w.value++
  }
  return weeks.map(({ label, value }) => ({ label, value }))
})
const closedThisWeek = computed(() => throughput.value.at(-1)?.value ?? 0)
const closedTotal = computed(() => throughput.value.reduce((s, w) => s + w.value, 0))

const boardMap = computed(() => new Map(boards.value.map(b => [b.id, b])))
function boardName(id: string): string {
  return boardMap.value.get(id)?.name ?? '—'
}

const boardStats = computed(() =>
  boards.value
    .map((b) => {
      const bt = tasks.value.filter(t => t.boardId === b.id)
      const done = bt.filter(t => t.closedAt).length
      return {
        id: b.id,
        name: b.name,
        color: b.color,
        total: bt.length,
        done,
        pct: bt.length ? Math.round((done / bt.length) * 100) : 0,
      }
    })
    .sort((a, b) => b.total - a.total),
)

const deadlines = computed(() =>
  tasks.value
    .filter(t => !t.closedAt && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      boardId: t.boardId,
      title: t.title,
      board: boardName(t.boardId),
      due: formatRelativeDate(t.dueDate!),
      overdue: new Date(t.dueDate!).getTime() < Date.now(),
    })),
)

const blockedTasks = computed(() =>
  tasks.value
    .filter(t => !t.closedAt && t.blockedReason)
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      boardId: t.boardId,
      title: t.title,
      board: boardName(t.boardId),
      reason: t.blockedReason ?? '',
    })),
)

const VISIBLE_AVATARS = 8
const tooltipItems = computed(() =>
  members.value.slice(0, VISIBLE_AVATARS).map(m => ({
    id: m.userId,
    name: displayName(m),
    designation: ROLE_LABEL[m.role] ?? m.email,
    image: m.avatarUrl,
    initials: initials(m),
    color: avatarColor(m.userId),
  })),
)
const hiddenAvatars = computed(() => Math.max(0, members.value.length - VISIBLE_AVATARS))

function actorLabel(e: ActivityEvent): string {
  return displayName({
    firstName: e.actorFirstName,
    lastName: e.actorLastName,
    email: e.actorEmail ?? '',
  })
}
</script>

<template>
  <div class="space-y-5 py-2">
    <div class="relative sm:mt-10">
      <div
        class="relative flex flex-col justify-center overflow-hidden rounded-3xl px-5 py-5 sm:h-[180px] sm:px-8
               bg-gradient-to-br from-accent-50 via-white to-accent-100/40
              dark:from-accent-950/30 dark:via-zinc-900 dark:to-zinc-900"
      >
        <div class="absolute -right-16 -top-24 size-72 rounded-full bg-accent-400/15 blur-3xl" />
        <div class="relative sm:pr-60">
          <p class="text-sm text-muted">{{ greeting }},</p>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">
            <span class="text-accent-600">{{ firstName }}</span> 
          </h1>

          <div v-if="tasks.length" class="mt-4 grid grid-cols-3 gap-2 sm:mt-3 sm:flex sm:gap-x-7">
            <div>
              <p class="text-2xl sm:text-3xl font-bold leading-none text-accent-600">{{ openTasks }}</p>
              <p class="mt-1 text-xs text-muted">открыто</p>
            </div>
            <div>
              <p class="text-2xl sm:text-3xl font-bold leading-none text-error-600">{{ overdue }}</p>
              <p class="mt-1 text-xs text-muted">просрочено</p>
            </div>
            <div>
              <p class="text-2xl sm:text-3xl font-bold leading-none text-success-600">{{ closedThisWeek }}</p>
              <p class="mt-1 text-xs text-muted">за неделю</p>
            </div>
          </div>
          <p v-else class="mt-2 max-w-md text-sm text-muted">
            Создайте доску, чтобы здесь появилась аналитика потока.
          </p>
        </div>
      </div>
      <img
        src="/illustrations/remote-team.svg"
        alt=""
        class="pointer-events-none absolute bottom-0 right-3 hidden h-[210px] select-none drop-shadow-sm sm:block lg:right-10 lg:h-[240px]"
      >
    </div>

    <div v-if="loading" class="text-center py-16 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="isEmpty"
      class="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-default py-12 text-center"
    >
      <img src="/illustrations/programming.svg" alt="" class="w-48 select-none">
      <p class="font-medium text-default">Здесь пока пусто</p>
      <p class="text-sm text-muted">Создайте первую доску, чтобы видеть аналитику потока</p>
      <UButton :to="pageRoutes.boards(wsId)" icon="i-lucide-plus">К доскам</UButton>
    </div>

    <template v-else>
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="surface rounded-2xl p-5 lg:col-span-2">
          <div class="flex flex-col gap-1 mb-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="font-semibold text-default">Динамика потока</h2>
              <p class="text-xs text-muted">Закрыто задач по неделям</p>
            </div>
            <span class="text-xs text-muted">
              всего <span class="font-medium text-default">{{ closedTotal }}</span> за 8 нед.
            </span>
          </div>
          <WorkspaceFlowChart :weeks="throughput" />
        </div>

        <div class="surface rounded-2xl p-5">
          <h2 class="font-semibold text-default mb-3">Разбивка задач</h2>
          <WorkspaceTaskDonut :segments="donutSegments" :total="tasks.length" />
          <div class="mt-4 space-y-1.5">
            <div
              v-for="s in donutSegments"
              :key="s.name"
              class="flex items-center justify-between text-xs"
            >
              <span class="flex items-center gap-2 text-muted">
                <span class="size-2.5 rounded-full" :style="{ background: s.color }" />
                {{ s.name }}
              </span>
              <span class="font-medium text-default">{{ s.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="surface rounded-2xl p-5 lg:col-span-2">
          <h2 class="font-semibold text-default mb-4">Доски</h2>
          <div v-if="boardStats.length" class="space-y-3">
            <NuxtLink
              v-for="b in boardStats"
              :key="b.id"
              :to="pageRoutes.board(wsId, b.id)"
              class="block rounded-xl p-3 -mx-1 transition-colors hover:bg-elevated"
            >
              <div class="flex items-center justify-between gap-3 mb-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="size-2.5 rounded-full shrink-0" :style="{ background: b.color }" />
                  <span class="font-medium text-default truncate">{{ b.name }}</span>
                </div>
                <span class="text-xs text-muted shrink-0">{{ b.done }} / {{ b.total }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
                <div class="h-full rounded-full bg-accent-500" :style="{ width: `${b.pct}%` }" />
              </div>
            </NuxtLink>
          </div>
          <p v-else class="text-sm text-muted">Досок пока нет</p>
        </div>

        <div class="surface rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-default">Команда</h2>
            <NuxtLink
              :to="pageRoutes.workspaceMembers(wsId)"
              class="text-xs text-muted hover:text-accent-600 transition-colors"
            >
              Все →
            </NuxtLink>
          </div>
          <div class="flex items-center">
            <UiAnimatedTooltip :items="tooltipItems" :size="34" ring="var(--island-bg-2)" />
            <div
              v-if="hiddenAvatars > 0"
              class="-ml-2 flex shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-medium text-muted"
              :style="{ width: '34px', height: '34px', boxShadow: '0 0 0 2px var(--island-bg-2)' }"
            >
              +{{ hiddenAvatars }}
            </div>
          </div>
          <p class="mt-3 text-sm text-muted">
            <span class="font-medium text-default">{{ members.length }}</span>
            {{ plural(members.length, ['участник', 'участника', 'участников']) }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div class="surface rounded-2xl p-5">
          <h2 class="font-semibold text-default mb-4">Ближайшие дедлайны</h2>
          <div v-if="deadlines.length" class="space-y-1">
            <NuxtLink
              v-for="t in deadlines"
              :key="t.id"
              :to="pageRoutes.task(wsId, t.boardId, t.id)"
              class="flex items-center gap-3 rounded-xl p-2 -mx-1 transition-colors hover:bg-elevated"
            >
              <div
                class="size-8 shrink-0 rounded-lg grid place-items-center"
                :class="t.overdue
                  ? 'bg-error-50 text-error-600 dark:bg-error-950/50'
                  : 'bg-accent-50 text-accent-600 dark:bg-accent-950/50'"
              >
                <UIcon name="i-lucide-calendar-clock" class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-default truncate">{{ t.title }}</p>
                <p class="text-xs text-muted truncate">
                  {{ t.board }} ·
                  <span :class="t.overdue ? 'text-error-600' : ''">{{ t.due }}</span>
                </p>
              </div>
            </NuxtLink>
          </div>
          <p v-else class="text-sm text-muted">Дедлайнов нет</p>
        </div>

        <div class="surface rounded-2xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <h2 class="font-semibold text-default">Застряли</h2>
            <span
              v-if="blockedCount"
              class="text-[11px] font-medium text-error-600 bg-error-50 dark:bg-error-950/50 px-1.5 py-0.5 rounded-full"
            >
              {{ blockedCount }}
            </span>
          </div>
          <div v-if="blockedTasks.length" class="space-y-1">
            <NuxtLink
              v-for="t in blockedTasks"
              :key="t.id"
              :to="pageRoutes.task(wsId, t.boardId, t.id)"
              class="flex items-start gap-3 rounded-xl p-2 -mx-1 transition-colors hover:bg-elevated"
            >
              <UIcon name="i-lucide-octagon-alert" class="size-4 mt-0.5 shrink-0 text-error-600" />
              <div class="min-w-0 flex-1">
                <p class="text-sm text-default truncate">{{ t.title }}</p>
                <p class="text-xs text-muted truncate">{{ t.reason || t.board }}</p>
              </div>
            </NuxtLink>
          </div>
          <p v-else class="text-sm text-muted">Заблокированных задач нет</p>
        </div>

        <div class="surface rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-default">Активность</h2>
            <NuxtLink
              :to="pageRoutes.workspaceActivity(wsId)"
              class="text-xs text-muted hover:text-accent-600 transition-colors"
            >
              Вся →
            </NuxtLink>
          </div>
          <div v-if="events.length" class="space-y-3">
            <div v-for="e in events" :key="e.id" class="flex items-start gap-2.5">
              <UIcon name="i-lucide-activity" class="size-4 mt-0.5 text-muted shrink-0" />
              <div class="min-w-0 flex-1 text-sm">
                <p class="text-default leading-snug break-words">
                  <span class="font-medium">{{ actorLabel(e) }}</span>
                  <span class="text-muted"> {{ humanizeTaskEventType(e.eventType).toLowerCase() }}</span>
                  <span v-if="e.taskTitle"> «{{ e.taskTitle }}»</span>
                </p>
                <p class="text-xs text-muted">{{ formatRelativeDate(e.createdAt) }}</p>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-muted">Событий пока нет</p>
        </div>
      </div>
    </template>
  </div>
</template>
