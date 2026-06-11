<script setup lang="ts">
const colorMode = useColorMode()
const { logout } = useAuthApi()

type PeekEvent = {
  iconType: 'move' | 'at' | 'build' | 'check'
  color: string
  title: string
  sub: string
  act: string
}

type Notif = {
  id: number
  iconType: 'at' | 'move' | 'check'
  color: string
  who: string
  txt: string
  t: string
  unread: boolean
}

const EVENTS: PeekEvent[] = [
  { iconType: 'move', color: '#2e6df5', title: 'Вера → PAY-187', sub: 'перенесла в «На ревью»', act: 'Открыть' },
  { iconType: 'at', color: '#7a4cf0', title: 'Артём упомянул вас', sub: 'в комментарии к PAY-204', act: 'Ответить' },
  { iconType: 'build', color: '#1f9d55', title: 'Сборка #841 прошла', sub: 'CI · ветка feature/2fa', act: 'Логи' },
  { iconType: 'check', color: '#1f9d55', title: 'PAY-201 закрыта', sub: 'Миша · 8 SP', act: '' },
]

const PRESENCE = [
  { id: 'vera', name: 'Вера', color: '#7a4cf0', initials: 'В' },
  { id: 'misha', name: 'Миша', color: '#2e6df5', initials: 'М' },
  { id: 'artem', name: 'Артём', color: '#1f9d55', initials: 'А' },
]

const { time, weekday } = useClock()
const { open, pinned, peek, reducedMotion, islStyle, notchStyle, peekStyle, panelStyle, doOpen, doClose, togglePin, firePeek } = useIsland()

const focus = ref(false)
const sec = ref(134)
const running = ref(true)
const notifs = ref<Notif[]>([
  { id: 1, iconType: 'at', color: '#7a4cf0', who: 'Артём', txt: 'упомянул вас в PAY-204', t: '2 мин', unread: true },
  { id: 2, iconType: 'move', color: '#2e6df5', who: 'Вера', txt: 'перенесла PAY-187 в «На ревью»', t: '12 мин', unread: true },
  { id: 3, iconType: 'check', color: '#1f9d55', who: 'Миша', txt: 'закрыл PAY-201', t: '1 ч', unread: false },
])

const unreadCount = computed(() => notifs.value.filter(n => n.unread).length)
const isDark = computed(() => colorMode.preference === 'dark')

let runTimer: ReturnType<typeof setInterval> | null = null
let demoTimer: ReturnType<typeof setInterval> | null = null
let demoIdx = 0

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

function markRead(e: Event, id: number) {
  e.stopPropagation()
  notifs.value = notifs.value.map(n => n.id === id ? { ...n, unread: false } : n)
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

onMounted(() => {
  startRunTimer()
  demoTimer = setInterval(() => {
    firePeek(EVENTS[demoIdx % EVENTS.length]!)
    demoIdx++
  }, 9000)
})

onUnmounted(() => {
  if (runTimer) clearInterval(runTimer)
  if (demoTimer) clearInterval(demoTimer)
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
