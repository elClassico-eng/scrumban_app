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
const ALL_BOARDS = '__all__'
const selectedBoard = ref<string>(ALL_BOARDS)

const { list: activityList } = useActivityApi(
  wsId,
  computed(() => ({ board: selectedBoard.value === ALL_BOARDS ? undefined : selectedBoard.value })),
)

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

const { open: myOpen, attention: myAttention } = useMyTasks(tasks, () => authStore.user?.id ?? null)
const greeting = computed(() => {
  const h = new Date().getHours()
  const word = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
  const first = authStore.user?.firstName?.trim()
  const parts = [`${word}${first ? `, ${first}` : ''}`]
  if (authStore.user) {
    parts.push(`${myOpen.value.length} ${plural(myOpen.value.length, ['открытая', 'открытых', 'открытых'])}`)
    const blocked = myAttention.value.filter(i => i.kind === 'blocked').length
    const overdue = myAttention.value.filter(i => i.kind === 'overdue').length
    if (blocked) parts.push(`${blocked} в блоке`)
    if (overdue) parts.push(`${overdue} ${plural(overdue, ['просрочена', 'просрочено', 'просрочено'])}`)
  }
  return parts.join(' · ')
})

const boardItems = computed(() => [
  { label: 'Все доски', value: ALL_BOARDS },
  ...boards.value.map(b => ({ label: b.name, value: b.id })),
])

// Personal blocks stay workspace-wide on purpose; the selector scopes only
// the team-level cards below it.
const scopedTasks = computed(() =>
  selectedBoard.value === ALL_BOARDS
    ? tasks.value
    : tasks.value.filter(t => t.boardId === selectedBoard.value),
)

const doneTasks = computed(() => scopedTasks.value.filter(t => t.closedAt).length)
const openTasks = computed(() => scopedTasks.value.filter(t => !t.closedAt && !t.blockedReason).length)
const blockedCount = computed(() => scopedTasks.value.filter(t => !t.closedAt && t.blockedReason).length)

const donutSegments = computed(() =>
  [
    { name: 'Выполнено', value: doneTasks.value, color: '#22c55e' },
    { name: 'Открыто', value: openTasks.value, color: '#e85002' },
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
  for (const t of scopedTasks.value) {
    if (!t.closedAt) continue
    const w = byKey.get(startOfWeek(new Date(t.closedAt)).getTime())
    if (w) w.value++
  }
  return weeks.map(({ label, value }) => ({ label, value }))
})
const closedTotal = computed(() => throughput.value.reduce((s, w) => s + w.value, 0))

function actorLabel(e: ActivityEvent): string {
  return displayName({
    firstName: e.actorFirstName,
    lastName: e.actorLastName,
    email: e.actorEmail ?? '',
  })
}
</script>

<template>
  <div class="space-y-4 py-2">
    <UiPageHeader title="Обзор" :subtitle="greeting" class="pt-2 mb-0">
      <template #actions>
        <USelect v-model="selectedBoard" :items="boardItems" class="w-full sm:w-56" />
      </template>
    </UiPageHeader>

    <WorkspaceSprintCard
      :ws-id="wsId"
      :board-id="selectedBoard === ALL_BOARDS ? undefined : selectedBoard"
    />

    <WorkspaceTodayPanel
      :ws-id="wsId"
      :user-id="authStore.user?.id ?? null"
      :tasks="tasks"
      :boards="boards"
    />

    <WorkspaceActivityHeatmap
      :ws-id="wsId"
      :user-id="authStore.user?.id ?? null"
      :board-id="selectedBoard === ALL_BOARDS ? undefined : selectedBoard"
      :members="members"
    />

    <div v-if="loading" class="py-16 text-center text-muted">
      <UIcon name="i-lucide-loader" class="size-6 animate-spin" />
    </div>

    <UiEmptyState
      v-else-if="isEmpty"
      icon="i-lucide-layout-dashboard"
      title="Здесь пока пусто"
      text="Создайте первую доску, чтобы видеть аналитику потока"
    >
      <template #actions>
        <UButton :to="pageRoutes.boards(wsId)" icon="i-lucide-plus">К доскам</UButton>
      </template>
    </UiEmptyState>

    <template v-else>
      <div class="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
        <WorkspaceAttentionList
          class="lg:col-span-8 lg:h-[var(--card-m)]"
          :ws-id="wsId"
          :tasks="scopedTasks"
          :boards="boards"
          :members="members"
        />

        <UiPanel title="Активность" class="lg:col-span-4 lg:h-[var(--card-m)]">
          <template #actions>
            <NuxtLink
              :to="pageRoutes.workspaceActivity(wsId)"
              class="text-xs text-muted transition-colors hover:text-accent-600"
            >
              Вся →
            </NuxtLink>
          </template>
          <div v-if="events.length" class="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div v-for="e in events" :key="e.id" class="flex items-start gap-2.5">
              <UIcon name="i-lucide-activity" class="mt-0.5 size-4 shrink-0 text-muted" />
              <div class="min-w-0 flex-1 text-sm">
                <p class="leading-snug break-words text-default">
                  <span v-if="e.taskTitle" class="font-medium">«{{ e.taskTitle }}»</span>
                  <span class="text-muted">{{ e.taskTitle ? ' ' : '' }}{{ humanizeTaskEventType(e.eventType).toLowerCase() }}</span>
                </p>
                <p class="text-xs text-muted">{{ actorLabel(e) }} · {{ formatRelativeDate(e.createdAt) }}</p>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-muted">Событий пока нет</p>
        </UiPanel>
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
        <UiPanel
          title="Динамика потока"
          hint="Закрыто задач по неделям за последние 8 недель."
          :caption="`всего ${closedTotal} за 8 нед.`"
          class="lg:col-span-8 lg:h-[var(--card-m)]"
        >
          <WorkspaceFlowChart :weeks="throughput" />
        </UiPanel>

        <UiPanel title="Разбивка задач" class="lg:col-span-4 lg:h-[var(--card-m)]">
          <WorkspaceTaskDonut :segments="donutSegments" :total="scopedTasks.length" />
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
        </UiPanel>
      </div>
    </template>
  </div>
</template>
