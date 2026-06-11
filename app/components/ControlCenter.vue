<script setup lang="ts">
import type { Notification, NotificationType } from '#shared/types/notification'
import { pageRoutes } from '~/routing'

const colorMode = useColorMode()
const { logout } = useAuthApi()
const router = useRouter()
const route = useRoute()

type TileIconType = 'at' | 'move' | 'check' | 'alert' | 'refresh' | 'trend'
type PeekIconType = 'move' | 'at' | 'build' | 'check'

type TileNotif = {
  id: string
  iconType: TileIconType
  color: string
  who: string
  txt: string
  t: string
  unread: boolean
}

const PRESENCE = [
  { id: 'vera', name: 'Вера', color: '#7a4cf0', initials: 'В' },
  { id: 'misha', name: 'Миша', color: '#2e6df5', initials: 'М' },
  { id: 'artem', name: 'Артём', color: '#1f9d55', initials: 'А' },
]

const NOTIF_ICON: Record<NotificationType, TileIconType> = {
  mention: 'at',
  assigned: 'check',
  comment_on_assigned: 'at',
  sle_breach: 'alert',
  replenishment_overdue: 'refresh',
  sprint_forecast_drop: 'trend',
}

const NOTIF_COLOR: Record<NotificationType, string> = {
  mention: '#7a4cf0',
  assigned: '#2e6df5',
  comment_on_assigned: '#7a4cf0',
  sle_breach: '#e85002',
  replenishment_overdue: '#e85002',
  sprint_forecast_drop: '#e85002',
}

const NOTIF_PEEK_ICON: Record<NotificationType, PeekIconType> = {
  mention: 'at',
  assigned: 'check',
  comment_on_assigned: 'at',
  sle_breach: 'check',
  replenishment_overdue: 'check',
  sprint_forecast_drop: 'check',
}

const NOTIF_TITLE: Record<NotificationType, string> = {
  mention: 'Упомянули в комментарии',
  assigned: 'Назначили задачу',
  comment_on_assigned: 'Прокомментировали вашу задачу',
  sle_breach: 'Задача застряла дольше SLE',
  replenishment_overdue: 'Пора провести Replenishment',
  sprint_forecast_drop: 'Прогноз спринта упал',
}

function getNotifDescription(n: Notification): string {
  const p = n.payload as Record<string, string>
  switch (n.type) {
    case 'mention':
    case 'comment_on_assigned':
    case 'assigned':
    case 'sle_breach':
      return p.taskTitle ?? ''
    case 'replenishment_overdue':
      return p.boardName ?? ''
    case 'sprint_forecast_drop':
      return p.sprintName ?? ''
  }
}

function getNotifActor(n: Notification): string {
  const p = n.payload as Record<string, string>
  return p.actorName ?? p.actorEmail ?? ''
}

function mapToTileNotif(n: Notification): TileNotif {
  return {
    id: n.id,
    iconType: NOTIF_ICON[n.type],
    color: NOTIF_COLOR[n.type],
    who: getNotifActor(n),
    txt: getNotifDescription(n),
    t: formatRelativeDate(n.createdAt),
    unread: n.readAt === null,
  }
}

function mapToChip(n: Notification) {
  return {
    iconType: NOTIF_PEEK_ICON[n.type],
    color: NOTIF_COLOR[n.type],
    title: NOTIF_TITLE[n.type],
    sub: getNotifDescription(n),
    act: '',
  }
}

const { list, unreadCount: unreadQuery, markRead: markReadMutation } = useNotificationsApi()
useNotificationsSse()

const rawNotifs = computed(() => list.data.value?.notifications ?? [])
const notifs = computed<TileNotif[]>(() => rawNotifs.value.map(mapToTileNotif))
const unreadCount = computed(() => unreadQuery.data.value?.count ?? 0)

const peekPrimed = ref(false)
watch(() => list.isFetched.value, (fetched) => {
  if (fetched) peekPrimed.value = true
}, { immediate: true })

const { time, weekday } = useClock()
const { open, pinned, peek, reducedMotion, islStyle, notchStyle, peekStyle, panelStyle, doOpen, doClose, togglePin, firePeek } = useIsland()

const focus = useLocalStorage('scrumban:cc-focus', false)
const isDark = computed(() => colorMode.preference === 'dark')

const wsStore = useWorkspaceStore()
const workspaceId = computed(() => wsStore.currentId ?? '')
const { list: workspacesList } = useWorkspacesApi()
const role = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === workspaceId.value)?.role,
)
const canCreateTask = computed(() => hasRole(role.value, 'member'))

const ccActions = useControlCenterActions()
const { list: activeTimer } = useActiveTimerApi(workspaceId)
const active = computed(() => activeTimer.data.value?.active ?? null)
const timerActive = computed(() => active.value !== null)
const activeBoardId = computed(() => active.value?.boardId ?? '')
const activeTaskId = computed(() => active.value?.entry.taskId ?? '')
const timerTaskId = computed(() => active.value?.taskShortId ?? '')
const timerTaskTitle = computed(() => active.value?.taskTitle ?? '')

const { stop: stopTimerMut } = useTaskTimeApi(workspaceId, activeBoardId, activeTaskId)

const elapsed = ref(0)
let tick: ReturnType<typeof setInterval> | null = null

function stopTick() {
  if (tick) { clearInterval(tick); tick = null }
}

function startTick() {
  stopTick()
  if (!timerActive.value) return
  tick = setInterval(() => { elapsed.value++ }, 1000)
}

watch(active, (a) => {
  elapsed.value = a?.entry.elapsedSeconds ?? 0
  startTick()
}, { immediate: true })

function onTimerToggle(e: Event) {
  e.stopPropagation()
  if (timerActive.value) stopTimerMut.mutate()
}

function onTimerStop(e: Event) {
  e.stopPropagation()
  if (timerActive.value) stopTimerMut.mutate()
}

function onQuickTask(e: Event) {
  e.stopPropagation()
  if (!canCreateTask.value) return
  if (route.params.boardId && route.params.id) ccActions.requestCreateTask()
  else if (workspaceId.value) router.push(pageRoutes.boards(workspaceId.value))
}

function onQuickSearch(e: Event) {
  e.stopPropagation()
  ccActions.requestSearch()
}

function toggleFocus(e: Event) {
  e.stopPropagation()
  focus.value = !focus.value
}

function toggleTheme(e: Event) {
  e.stopPropagation()
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

function doLogout(e: Event) {
  e.stopPropagation()
  logout.mutate()
}

async function markRead(e: Event, id: string) {
  e.stopPropagation()
  markReadMutation.mutate(id)
  const n = rawNotifs.value.find(x => x.id === id)
  if (!n) return
  const p = n.payload as Record<string, string>
  if (p.taskId && p.boardId) {
    await router.push(pageRoutes.task(n.workspaceId, p.boardId, p.taskId))
  }
}

function onIslandClick() {
  if (!open.value) open.value = true
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    open.value = !open.value
  }
  if (e.key === 'Escape') {
    open.value = false
    pinned.value = false
  }
}

watch(rawNotifs, (next, prev) => {
  if (!peekPrimed.value || focus.value || !prev || next.length <= prev.length) return
  const prevIds = new Set(prev.map(n => n.id))
  const newest = next.find(n => !prevIds.has(n.id))
  if (newest) firePeek(mapToChip(newest))
}, { flush: 'sync' })

onUnmounted(() => {
  stopTick()
})
</script>

<template>
  <div
    class="fixed top-4 left-1/2 z-[100] flex flex-col items-center -translate-x-1/2"
    tabindex="0"
    aria-label="Центр управления"
    @mouseenter="doOpen"
    @mouseleave="doClose"
    @click="onIslandClick"
    @keydown="onKeydown"
  >
    <div
      :style="[islStyle, { background: 'linear-gradient(180deg,var(--island-bg-2),var(--island-bg))', border: '1px solid var(--island-line)', color: 'var(--island-ink)', boxShadow: '0 1px 0 var(--island-line-2) inset, 0 18px 50px -16px rgba(0,0,0,0.55), 0 6px 16px -8px rgba(0,0,0,0.4)' }]"
      class="relative overflow-hidden"
    >
      <div
        class="absolute top-0 left-0 right-0 h-[52px] flex items-center gap-3 pl-4 pr-2"
        :style="notchStyle"
      >
        <ControlCenterIslandNotch
          :time="time"
          :weekday="weekday"
          :timer-task-id="timerTaskId"
          :seconds="elapsed"
          :running="timerActive"
          :active="timerActive"
          :unread="unreadCount"
          @bell.stop
        />
      </div>

      <div
        class="absolute top-0 left-0 right-0 h-[52px] flex items-center gap-[11px] px-4"
        :style="peekStyle"
        aria-live="polite"
        aria-atomic="true"
      >
        <ControlCenterIslandPeek :peek="peek" />
      </div>

      <div
        class="absolute inset-0 p-[14px] flex flex-col gap-[10px]"
        :style="panelStyle"
      >
        <ControlCenterIslandPanel
          :time="time"
          :weekday="weekday"
          :pinned="pinned"
          :reduced-motion="reducedMotion"
          :timer-task-id="timerTaskId"
          :timer-task-title="timerTaskTitle"
          :seconds="elapsed"
          :running="timerActive"
          :timer-active="timerActive"
          :sprint-pct="64"
          sprint-caption="Спринт 24 · 6 дн"
          :people="PRESENCE"
          :presence-extra="2"
          :notifs="notifs"
          :focus-on="focus"
          :is-dark="isDark"
          :can-create-task="canCreateTask"
          @toggle-pin="togglePin"
          @toggle-running="onTimerToggle"
          @stop-timer="onTimerStop"
          @mark-read="markRead"
          @quick-task="onQuickTask"
          @quick-search="onQuickSearch"
          @toggle-focus="toggleFocus"
          @toggle-theme="toggleTheme"
          @logout="doLogout"
        />
      </div>
    </div>
  </div>
</template>
