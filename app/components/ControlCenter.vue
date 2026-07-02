<script setup lang="ts">
import type { Notification, NotificationType } from '#shared/types/notification'
import { pageRoutes } from '~/routing'

const colorMode = useColorMode()
const { logout } = useAuthApi()
const router = useRouter()
const route = useRoute()
const uiStore = useUiStore()

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

const rawNotifs = computed(() => list.data.value?.notifications ?? [])
const notifs = computed<TileNotif[]>(() => rawNotifs.value.map(mapToTileNotif))
const unreadCount = computed(() => unreadQuery.data.value?.count ?? 0)

const peekPrimed = ref(false)
watch(() => list.isFetched.value, (fetched) => {
  if (fetched) peekPrimed.value = true
}, { immediate: true })

const { time, weekday } = useClock()
const { open, pinned, peek, hovered, reducedMotion, islStyle, notchStyle, peekStyle, panelStyle, onPointerEnter, onPointerLeave, onActivate, togglePin, firePeek } = useIsland()

const toast = useToast()
const confirm = useConfirm()
const { focus, toggle: toggleFocusMode } = useFocusMode()
const isDark = computed(() => colorMode.preference === 'dark')

const wsStore = useWorkspaceStore()
const workspaceId = computed(() => wsStore.currentId ?? '')
const { list: workspacesList } = useWorkspacesApi()
const role = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === workspaceId.value)?.role,
)
const canCreateTask = computed(() => hasRole(role.value, 'member'))

const { list: membersList } = useMembersApi(workspaceId)
const presencePeople = computed(() => {
  const members = membersList.data.value?.members ?? []
  return members.slice(0, 5).map(m => ({
    id: m.userId,
    name: displayName(m),
    color: avatarColor(m.userId),
    initials: initials(m),
    avatarUrl: m.avatarUrl,
  }))
})
const presenceExtra = computed(() => Math.max(0, (membersList.data.value?.members.length ?? 0) - 5))

const boardId = computed(() => (route.params.boardId as string) ?? '')

const { list: boardsList, recordReplenishment } = useBoardsApi(workspaceId)
const board = computed(() => boardsList.data.value?.boards.find(b => b.id === boardId.value) ?? null)
const canManageBoard = computed(() => hasRole(role.value, 'admin'))
const sleLabel = computed(() => {
  const b = board.value
  if (!b) return null
  if (b.sleDays == null) return null
  return `${Math.round(Number(b.sleProbability) * 100)}% · ≤ ${b.sleDays} дн`
})
const replenishmentLabel = computed(() => {
  const b = board.value
  if (!b?.lastReplenishmentAt) return null
  const due = new Date(b.lastReplenishmentAt).getTime() + b.replenishmentPeriodDays * 86_400_000
  const daysLeft = Math.round((due - Date.now()) / 86_400_000)
  return daysLeft < 0 ? `просрочено ${-daysLeft} дн` : `через ${daysLeft} дн`
})
const replenishmentOverdue = computed(() => {
  const b = board.value
  if (!b?.lastReplenishmentAt) return false
  const due = new Date(b.lastReplenishmentAt).getTime() + b.replenishmentPeriodDays * 86_400_000
  return (due - Date.now()) < 0
})
const hasBoardMetrics = computed(() => !!boardId.value && !!board.value)

const { list: sprintsList } = useSprintsApi(workspaceId, boardId)
const activeSprint = computed(() => sprintsList.data.value?.sprints.find(s => s.state === 'active') ?? null)
const hasSprint = computed(() => activeSprint.value !== null)
const sprintPct = computed(() => {
  const s = activeSprint.value
  if (!s || !s.startedAt || !s.plannedEndAt) return 0
  const start = new Date(s.startedAt).getTime()
  const end = new Date(s.plannedEndAt).getTime()
  if (end <= start) return 0
  return Math.round(Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)))
})
const sprintCaption = computed(() => {
  const s = activeSprint.value
  if (!s) return 'Нет активного спринта'
  if (!s.plannedEndAt) return s.name
  const daysLeft = Math.max(0, Math.ceil((new Date(s.plannedEndAt).getTime() - Date.now()) / 86_400_000))
  return `${s.name} · ${daysLeft} дн`
})

const ccActions = useControlCenterActions()
const { list: activeTimer } = useActiveTimerApi(workspaceId)
const active = computed(() => activeTimer.data.value?.active ?? null)

type PausedTask = { boardId: string; taskId: string; shortId: string; title: string }
const paused = ref<PausedTask | null>(null)

const running = computed(() => active.value !== null)
const hasTask = computed(() => running.value || paused.value !== null)
const currentBoardId = computed(() => active.value?.boardId ?? paused.value?.boardId ?? '')
const currentTaskId = computed(() => active.value?.entry.taskId ?? paused.value?.taskId ?? '')
const timerTaskId = computed(() => active.value?.taskShortId ?? paused.value?.shortId ?? '')
const timerTaskTitle = computed(() => active.value?.taskTitle ?? paused.value?.title ?? '')

const { start: startTimerMut, stop: stopTimerMut } = useTaskTimeApi(workspaceId, currentBoardId, currentTaskId)

const elapsed = ref(0)
const sessionBase = ref(0)
let sessionTaskId = ''
let tick: ReturnType<typeof setInterval> | null = null

function stopTick() {
  if (tick) { clearInterval(tick); tick = null }
}

function startTick() {
  stopTick()
  tick = setInterval(() => { elapsed.value++ }, 1000)
}

watch(active, (a) => {
  if (a) {
    paused.value = null
    if (a.entry.taskId !== sessionTaskId) {
      sessionTaskId = a.entry.taskId
      sessionBase.value = 0
    }
    elapsed.value = sessionBase.value + a.entry.elapsedSeconds
    startTick()
  }
  else {
    stopTick()
  }
}, { immediate: true })

function onTimerToggle(e: Event) {
  e.stopPropagation()
  if (running.value) {
    const a = active.value
    if (!a) return
    stopTick()
    sessionBase.value = elapsed.value
    paused.value = { boardId: a.boardId, taskId: a.entry.taskId, shortId: a.taskShortId, title: a.taskTitle }
    stopTimerMut.mutate()
  }
  else if (paused.value) {
    startTimerMut.mutate()
  }
}

function onTimerStop(e: Event) {
  e.stopPropagation()
  if (running.value) stopTimerMut.mutate()
  paused.value = null
  sessionBase.value = 0
  sessionTaskId = ''
  elapsed.value = 0
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
  toggleFocusMode()
  toast.add({
    title: focus.value ? 'Режим фокуса включён' : 'Режим фокуса выключен',
    description: focus.value
      ? 'Всплывающие уведомления приглушены'
      : 'Уведомления снова показываются',
    icon: focus.value ? 'i-lucide-focus' : 'i-lucide-bell',
  })
}

async function onMarkReplenishment(e: Event) {
  e.stopPropagation()
  if (!canManageBoard.value || !boardId.value) return
  const ok = await confirm({
    title: 'Отметить replenishment сейчас?',
    description: 'Сбросит счётчик периода. Используй после реальной встречи планирования backlog\'а.',
    confirmLabel: 'Отметить',
  })
  if (!ok) return
  try {
    await recordReplenishment.mutateAsync(boardId.value)
    toast.add({ title: 'Replenishment отмечен', icon: 'i-lucide-check-circle', color: 'success' })
  }
  catch {
    toast.add({ title: 'Не удалось отметить', color: 'error', icon: 'i-lucide-alert-circle' })
  }
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

function onViewTeam(e: Event) {
  e.stopPropagation()
  if (workspaceId.value) router.push(pageRoutes.workspaceMembers(workspaceId.value))
}

const cmdKLabel = computed(() => (import.meta.client && /Mac|iPhone|iPad/i.test(navigator.userAgent)) ? '⌘K' : 'Ctrl K')

function onCmdK(e: Event) {
  e.stopPropagation()
  ccActions.requestSearch()
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
    class="fixed top-3 left-1/2 z-[100] -translate-x-1/2 hidden lg:flex items-start gap-2"
    @mouseenter="onPointerEnter"
    @mouseleave="onPointerLeave"
  >
    <div
      :style="[islStyle, { background: 'var(--island-glass)', backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)', border: '1px solid var(--island-glass-border)', color: 'var(--island-ink)', boxShadow: '0 1px 0 var(--island-glass-inset) inset, var(--island-shadow)' }]"
      class="relative overflow-hidden cursor-pointer"
      tabindex="0"
      aria-label="Центр управления"
      title="Нажмите, чтобы открыть центр управления"
      @click="onActivate"
      @keydown="onKeydown"
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
          :running="running"
          :active="hasTask"
          :unread="unreadCount"
          :expanded="hovered"
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
          :running="running"
          :timer-active="hasTask"
          :sprint-pct="sprintPct"
          :sprint-caption="sprintCaption"
          :sprint-active="hasSprint"
          :people="presencePeople"
          :presence-extra="presenceExtra"
          :notifs="notifs"
          :focus-on="focus"
          :is-dark="isDark"
          :can-create-task="canCreateTask"
          :sle-label="sleLabel"
          :replenishment-label="replenishmentLabel"
          :replenishment-overdue="replenishmentOverdue"
          :has-board-metrics="hasBoardMetrics"
          :replenishment-clickable="canManageBoard"
          @toggle-pin="togglePin"
          @mark-replenishment="onMarkReplenishment"
          @toggle-running="onTimerToggle"
          @stop-timer="onTimerStop"
          @mark-read="markRead"
          @quick-task="onQuickTask"
          @quick-search="onQuickSearch"
          @toggle-focus="toggleFocus"
          @toggle-theme="toggleTheme"
          @logout="doLogout"
          @view-all="onViewTeam"
        />
      </div>
    </div>

    <button
      v-show="hovered && !open"
      type="button"
      class="h-[52px] min-w-[52px] px-4 rounded-[22px] grid place-items-center text-[12px] font-semibold whitespace-nowrap cursor-pointer shrink-0"
      style="background: var(--island-glass); backdrop-filter: blur(20px) saturate(150%); -webkit-backdrop-filter: blur(20px) saturate(150%); border: 1px solid var(--island-glass-border); color: var(--island-ink-2); box-shadow: 0 1px 0 var(--island-glass-inset) inset, var(--island-shadow);"
      title="Командная палитра (открыть)"
      @click.stop="onCmdK"
    >{{ cmdKLabel }}</button>
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="uiStore.controlCenterOpen"
        class="lg:hidden fixed inset-0 z-[200] flex flex-col"
        style="background: var(--island-bg); color: var(--island-ink);"
      >
        <div
          class="flex items-center justify-between px-4 h-14 shrink-0"
          style="border-bottom: 1px solid var(--island-line-2);"
        >
          <span class="text-[15px] font-semibold">Центр управления</span>
          <button
            type="button"
            class="size-9 grid place-items-center rounded-lg cursor-pointer"
            style="background: var(--island-fill); color: var(--island-ink-2);"
            aria-label="Закрыть"
            @click="uiStore.closeControlCenter"
          >
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-[10px]">
          <ControlCenterIslandPanel
            :time="time"
            :weekday="weekday"
            :pinned="pinned"
            :reduced-motion="reducedMotion"
            :timer-task-id="timerTaskId"
            :timer-task-title="timerTaskTitle"
            :seconds="elapsed"
            :running="running"
            :timer-active="hasTask"
            :sprint-pct="sprintPct"
            :sprint-caption="sprintCaption"
            :sprint-active="hasSprint"
            :people="presencePeople"
            :presence-extra="presenceExtra"
            :notifs="notifs"
            :focus-on="focus"
            :is-dark="isDark"
            :can-create-task="canCreateTask"
            :sle-label="sleLabel"
            :replenishment-label="replenishmentLabel"
            :replenishment-overdue="replenishmentOverdue"
            :has-board-metrics="hasBoardMetrics"
            :replenishment-clickable="canManageBoard"
            @toggle-pin="togglePin"
            @mark-replenishment="onMarkReplenishment"
            @toggle-running="onTimerToggle"
            @stop-timer="onTimerStop"
            @mark-read="(e, id) => { markRead(e, id); uiStore.closeControlCenter() }"
            @quick-task="(e) => { onQuickTask(e); uiStore.closeControlCenter() }"
            @quick-search="(e) => { onQuickSearch(e); uiStore.closeControlCenter() }"
            @toggle-focus="toggleFocus"
            @toggle-theme="toggleTheme"
            @logout="doLogout"
            @view-all="(e) => { onViewTeam(e); uiStore.closeControlCenter() }"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
