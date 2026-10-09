<script setup lang="ts">
import { pageRoutes } from '~/routing'

const colorMode = useColorMode()
const { logout } = useAuthApi()
const router = useRouter()
const route = useRoute()
const uiStore = useUiStore()

const { rawNotifs, notifs, unreadCount, primed: peekPrimed, peekFor, targetOf, markRead: markReadMut } = useIslandNotifications()

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

const { hasSprint, sprintPct, sprintCaption } = useIslandSprint(workspaceId, boardId)

const ccActions = useControlCenterActions()
const { running, hasTask, timerTaskId, timerTaskTitle, elapsed, onToggle: onTimerToggle, onStop: onTimerStop } = useIslandTimer(workspaceId)

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
  markReadMut(id)
  const target = targetOf(id)
  if (target) await router.push(target)
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
  if (newest) firePeek(peekFor(newest))
}, { flush: 'sync' })

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
