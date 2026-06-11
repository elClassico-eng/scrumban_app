<script setup lang="ts">
import type { Notification, NotificationType } from '#shared/types/notification'
import { pageRoutes } from '~/routing'

const colorMode = useColorMode()
const { logout } = useAuthApi()
const router = useRouter()

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

const { time, weekday } = useClock()
const { open, pinned, peek, reducedMotion, islStyle, notchStyle, peekStyle, panelStyle, doOpen, doClose, togglePin, firePeek } = useIsland()

const focus = ref(false)
const sec = ref(134)
const running = ref(true)
const isDark = computed(() => colorMode.preference === 'dark')

let runTimer: ReturnType<typeof setInterval> | null = null

function startRunTimer() {
  if (runTimer) clearInterval(runTimer)
  if (!running.value) return
  runTimer = setInterval(() => { sec.value++ }, 1000)
}

function stopRunTimer() {
  if (runTimer) { clearInterval(runTimer); runTimer = null }
}

function toggleRunning(e: Event) {
  e.stopPropagation()
  running.value = !running.value
}

function stopTimer(e: Event) {
  e.stopPropagation()
  running.value = false
  sec.value = 0
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

watch(running, (val) => {
  if (val) startRunTimer()
  else stopRunTimer()
})

watch(rawNotifs, (next, prev) => {
  if (!prev || next.length <= prev.length) return
  const prevIds = new Set(prev.map(n => n.id))
  const newest = next.find(n => !prevIds.has(n.id))
  if (newest) firePeek(mapToChip(newest))
}, { flush: 'sync' })

onMounted(() => {
  startRunTimer()
})

onUnmounted(() => {
  if (runTimer) clearInterval(runTimer)
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
          timer-task-id="PAY-204"
          :seconds="sec"
          :running="running"
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
          timer-task-id="PAY-204"
          timer-task-title="Двухфакторная аутентификация для крупных переводов"
          :seconds="sec"
          :running="running"
          :sprint-pct="64"
          sprint-caption="Спринт 24 · 6 дн"
          :people="PRESENCE"
          :presence-extra="2"
          :notifs="notifs"
          :focus-on="focus"
          :is-dark="isDark"
          @toggle-pin="togglePin"
          @toggle-running="toggleRunning"
          @stop-timer="stopTimer"
          @mark-read="markRead"
          @quick-task="(e) => e.stopPropagation()"
          @quick-search="(e) => e.stopPropagation()"
          @toggle-focus="toggleFocus"
          @toggle-theme="toggleTheme"
          @logout="doLogout"
        />
      </div>
    </div>
  </div>
</template>
