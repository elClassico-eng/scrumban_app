<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const colorMode = useColorMode()
const { logout } = useAuthApi()

const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

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

type QuickAction = {
  key: string
  label: string
  icon: string
  handler: (e: Event) => void
  styleType: 'primary' | 'normal' | 'toggle'
  active?: boolean
}

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] as const

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

const ICON_MAP: Record<string, string> = {
  move: 'i-lucide-move',
  at: 'i-lucide-at-sign',
  build: 'i-lucide-hammer',
  check: 'i-lucide-check',
}

const open = ref(false)
const pinned = ref(false)
const focus = ref(false)
const now = ref(new Date())
const sec = ref(134)
const running = ref(true)
const peek = ref<PeekEvent | null>(null)
const notifs = ref<Notif[]>([
  { id: 1, iconType: 'at', color: '#7a4cf0', who: 'Артём', txt: 'упомянул вас в PAY-204', t: '2 мин', unread: true },
  { id: 2, iconType: 'move', color: '#2e6df5', who: 'Вера', txt: 'перенесла PAY-187 в «На ревью»', t: '12 мин', unread: true },
  { id: 3, iconType: 'check', color: '#1f9d55', who: 'Миша', txt: 'закрыл PAY-201', t: '1 ч', unread: false },
])

let clockTimer: ReturnType<typeof setInterval> | null = null
let runTimer: ReturnType<typeof setInterval> | null = null
let peekTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let demoTimer: ReturnType<typeof setInterval> | null = null
let demoIdx = 0

function pad(n: number) {
  return String(n).padStart(2, '0')
}

const timeStr = computed(() => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`)
const weekday = computed(() => WEEKDAYS[now.value.getDay()])
const timerStr = computed(() => `${pad(Math.floor(sec.value / 60))}:${pad(sec.value % 60)}`)
const unreadCount = computed(() => notifs.value.filter(n => n.unread).length)

const islW = computed(() => {
  if (open.value) return 720
  if (peek.value) return 440
  return 384
})
const islH = computed(() => open.value ? 524 : 52)
const islR = computed(() => open.value ? 30 : 26)

const sprintPct = 64
const ringSize = 78
const ringR = computed(() => ringSize / 2 - 6)
const ringC = computed(() => 2 * Math.PI * ringR.value)
const ringOffset = computed(() => ringC.value * (1 - sprintPct / 100))

const islStyle = computed(() => {
  const base = {
    width: `${islW.value}px`,
    height: `${islH.value}px`,
    borderRadius: `${islR.value}px`,
  }
  if (reducedMotion.value) return base
  return {
    ...base,
    transition: 'width .5s cubic-bezier(.34,1.4,.5,1), height .5s cubic-bezier(.34,1.4,.5,1), border-radius .4s cubic-bezier(.4,0,.2,1)',
  }
})

const notchStyle = computed(() => {
  const visibility = { opacity: open.value ? '0' : '1', pointerEvents: (open.value ? 'none' : 'auto') as 'none' | 'auto' }
  if (reducedMotion.value) return visibility
  return { ...visibility, transition: 'opacity .26s cubic-bezier(.4,0,.2,1)' }
})

const peekStyle = computed(() => {
  const visible = !!(peek.value && !open.value)
  const visibility = { opacity: visible ? '1' : '0', pointerEvents: (visible ? 'auto' : 'none') as 'none' | 'auto' }
  if (reducedMotion.value) return visibility
  return { ...visibility, transition: 'opacity .22s cubic-bezier(.4,0,.2,1)' }
})

const panelStyle = computed(() => {
  const base = {
    opacity: open.value ? '1' : '0',
    transform: open.value ? 'none' : 'translateY(-6px)',
    pointerEvents: (open.value ? 'auto' : 'none') as 'none' | 'auto',
  }
  if (reducedMotion.value) return { opacity: base.opacity, pointerEvents: base.pointerEvents }
  return { ...base, transition: 'opacity .3s cubic-bezier(.4,0,.2,1) .06s, transform .3s cubic-bezier(.4,0,.2,1) .06s' }
})

const themeIcon = computed(() => colorMode.preference === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon')

const quickActions = computed((): QuickAction[] => [
  { key: 'task', label: 'Задача', icon: 'i-lucide-plus', handler: (e) => e.stopPropagation(), styleType: 'primary' },
  { key: 'search', label: 'Поиск', icon: 'i-lucide-search', handler: (e) => e.stopPropagation(), styleType: 'normal' },
  { key: 'focus', label: 'Фокус', icon: 'i-lucide-focus', handler: toggleFocus, styleType: 'toggle', active: focus.value },
  { key: 'theme', label: 'Тема', icon: themeIcon.value, handler: toggleTheme, styleType: 'normal' },
  { key: 'logout', label: 'Выход', icon: 'i-lucide-log-out', handler: doLogout, styleType: 'normal' },
])

function resolveIcon(iconType: string): string {
  return ICON_MAP[iconType] ?? 'i-lucide-circle'
}

function actionStyle(action: QuickAction): string {
  if (action.styleType === 'primary') return 'background: #ff6a1a; color: #fff;'
  if (action.styleType === 'toggle' && action.active) return 'background: rgba(255,106,26,0.18); color: #ff894a;'
  return 'background: rgba(255,255,255,0.05); color: #b7b8c0;'
}

function startRunTimer() {
  if (runTimer) clearInterval(runTimer)
  if (!running.value) return
  runTimer = setInterval(() => { sec.value++ }, 1000)
}

function stopRunTimer() {
  if (runTimer) { clearInterval(runTimer); runTimer = null }
}

function firePeek(ev: PeekEvent) {
  if (open.value) return
  if (peekTimer) clearTimeout(peekTimer)
  peek.value = ev
  peekTimer = setTimeout(() => { peek.value = null }, 3200)
}

function doOpen() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  open.value = true
}

function doClose() {
  if (pinned.value) return
  closeTimer = setTimeout(() => { open.value = false }, 380)
}

function togglePin(e: Event) {
  e.stopPropagation()
  pinned.value = !pinned.value
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
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  startRunTimer()
  demoTimer = setInterval(() => {
    firePeek(EVENTS[demoIdx % EVENTS.length]!)
    demoIdx++
  }, 9000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (runTimer) clearInterval(runTimer)
  if (peekTimer) clearTimeout(peekTimer)
  if (closeTimer) clearTimeout(closeTimer)
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
      :style="[islStyle, { background: 'linear-gradient(180deg,#1e1e23,#16161a)', border: '1px solid rgba(255,255,255,0.09)', color: '#f4f4f6', boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 50px -16px rgba(0,0,0,0.55), 0 6px 16px -8px rgba(0,0,0,0.4)' }]"
      class="relative overflow-hidden"
    >
      <div
        class="absolute top-0 left-0 right-0 h-[52px] flex items-center gap-3 pl-4 pr-2"
        :style="notchStyle"
      >
        <div class="flex items-baseline gap-[7px] whitespace-nowrap">
          <b class="text-[15px] font-semibold tracking-[-0.01em]">{{ timeStr }}</b>
          <span class="text-[#7e7f8a]">·</span>
          <span class="text-[13px] text-[#7e7f8a]">{{ weekday }}</span>
        </div>
        <div class="flex-1" />
        <div
          class="inline-flex items-center gap-2 h-8 px-3 rounded-full text-[#ff894a] text-[12.5px] font-semibold whitespace-nowrap max-w-[220px] overflow-hidden"
          style="background: rgba(255,106,26,0.16); border: 1px solid rgba(255,106,26,0.3);"
        >
          <span
            class="w-[7px] h-[7px] rounded-full flex-shrink-0"
            :class="running ? 'bg-[#ff6a1a] cc-pulse-dot' : 'bg-[#7e7f8a]'"
          />
          <span class="font-mono text-[#b7b8c0] font-medium">PAY-204</span>
          <span class="font-mono">{{ timerStr }}</span>
        </div>
        <button
          class="relative w-9 h-9 rounded-full grid place-items-center border-none cursor-pointer text-[#b7b8c0] hover:text-[#f4f4f6] transition-colors"
          style="background: rgba(255,255,255,0.06);"
          title="Уведомления"
          aria-label="Уведомления"
          @click.stop
        >
          <UIcon name="i-lucide-bell" class="w-[18px] h-[18px]" />
          <span
            v-if="unreadCount > 0"
            class="absolute top-[6px] right-[6px] min-w-[15px] h-[15px] px-1 rounded-full bg-[#ff6a1a] text-white text-[9.5px] font-bold grid place-items-center"
            style="border: 2px solid #16161a;"
          >{{ unreadCount }}</span>
        </button>
      </div>

      <div
        class="absolute top-0 left-0 right-0 h-[52px] flex items-center gap-[11px] px-4"
        :style="peekStyle"
        aria-live="polite"
        aria-atomic="true"
      >
        <template v-if="peek">
          <span
            class="w-[30px] h-[30px] rounded-[9px] grid place-items-center flex-shrink-0 text-white"
            :style="{ background: peek.color }"
          >
            <UIcon :name="resolveIcon(peek.iconType)" class="w-[14px] h-[14px]" />
          </span>
          <div class="min-w-0">
            <b class="block text-[12.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis text-[#f4f4f6]">{{ peek.title }}</b>
            <span class="text-[11px] text-[#7e7f8a]">{{ peek.sub }}</span>
          </div>
          <div class="flex-1" />
          <span v-if="peek.act" class="text-[11.5px] font-semibold text-[#ff894a] whitespace-nowrap">{{ peek.act }}</span>
        </template>
      </div>

      <div
        class="absolute inset-0 p-[14px] flex flex-col gap-[10px]"
        :style="panelStyle"
      >
        <div class="flex items-center gap-3 px-1 pt-0.5">
          <div class="flex items-baseline gap-[7px]">
            <b class="text-[17px] font-semibold tracking-[-0.01em]">{{ timeStr }}</b>
            <span class="text-[#7e7f8a]">·</span>
            <span class="text-[13px] text-[#7e7f8a]">{{ weekday }}</span>
          </div>
          <div class="flex-1" />
          <button
            class="w-[30px] h-[30px] rounded-lg grid place-items-center border-none cursor-pointer transition-colors"
            :style="pinned ? 'background: rgba(255,106,26,0.2); color: #ff894a;' : 'background: rgba(255,255,255,0.06); color: #7e7f8a;'"
            title="Закрепить"
            aria-label="Закрепить"
            @click="togglePin"
          >
            <UIcon name="i-lucide-pin" class="w-[15px] h-[15px]" />
          </button>
        </div>

        <div class="grid gap-[10px]" style="grid-template-columns: 1.5fr 1fr;">
          <div
            class="rounded-2xl p-[13px]"
            style="background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06);"
          >
            <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7e7f8a] mb-[9px]">Активная задача</div>
            <div class="font-mono text-[11px] text-[#ff894a]">PAY-204 · в работе</div>
            <div class="text-[13.5px] font-medium leading-[1.3] mt-[3px] mb-3 text-[#f4f4f6]">Двухфакторная аутентификация для крупных переводов</div>
            <div class="flex items-center gap-3">
              <span
                class="font-mono text-[26px] font-semibold tracking-[-0.02em]"
                :style="running ? 'color: #ff894a;' : 'color: #f4f4f6;'"
              >{{ timerStr }}</span>
              <div class="flex gap-[6px] ml-auto">
                <button
                  class="w-9 h-9 rounded-[10px] border-none cursor-pointer grid place-items-center"
                  style="background: #ff6a1a; color: #fff;"
                  :title="running ? 'Пауза' : 'Запустить'"
                  :aria-label="running ? 'Пауза' : 'Запустить'"
                  @click="toggleRunning"
                >
                  <UIcon :name="running ? 'i-lucide-pause' : 'i-lucide-play'" class="w-4 h-4" />
                </button>
                <button
                  class="w-9 h-9 rounded-[10px] border-none cursor-pointer grid place-items-center"
                  style="background: rgba(255,255,255,0.07); color: #f4f4f6;"
                  title="Стоп"
                  aria-label="Стоп"
                  @click="stopTimer"
                >
                  <UIcon name="i-lucide-square" class="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>
          </div>

          <div
            class="rounded-2xl p-[13px] flex flex-col items-center justify-center text-center"
            style="background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06);"
          >
            <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7e7f8a] mb-[9px]">Спринт</div>
            <div class="relative w-[78px] h-[78px]">
              <svg
                :width="ringSize"
                :height="ringSize"
                :viewBox="`0 0 ${ringSize} ${ringSize}`"
                style="transform: rotate(-90deg);"
              >
                <circle
                  :cx="ringSize / 2"
                  :cy="ringSize / 2"
                  :r="ringR"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  stroke-width="6"
                />
                <circle
                  :cx="ringSize / 2"
                  :cy="ringSize / 2"
                  :r="ringR"
                  fill="none"
                  stroke="url(#ccRingGrad)"
                  stroke-width="6"
                  stroke-linecap="round"
                  :stroke-dasharray="ringC"
                  :stroke-dashoffset="ringOffset"
                  :style="reducedMotion ? {} : { transition: 'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }"
                />
                <defs>
                  <linearGradient id="ccRingGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#ff894a" />
                    <stop offset="100%" stop-color="#e4540a" />
                  </linearGradient>
                </defs>
              </svg>
              <div class="absolute inset-0 grid place-items-center">
                <div class="flex flex-col items-center">
                  <b class="text-[19px] font-bold tracking-[-0.02em] text-[#f4f4f6]">{{ sprintPct }}%</b>
                  <span class="text-[9px] text-[#7e7f8a] uppercase tracking-[0.05em]">спринт</span>
                </div>
              </div>
            </div>
            <div class="text-[11px] text-[#b7b8c0] mt-2">Спринт 24 · 6 дн</div>
          </div>
        </div>

        <div
          class="rounded-2xl p-[13px]"
          style="background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06);"
        >
          <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7e7f8a] mb-[9px]">Присутствие</div>
          <div class="flex items-center gap-2 flex-wrap">
            <span
              v-for="p in PRESENCE"
              :key="p.id"
              class="flex items-center gap-[7px] rounded-full py-1 pr-[10px] pl-1"
              style="background: rgba(255,255,255,0.05);"
            >
              <span
                class="relative w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                :style="{ background: p.color }"
              >
                {{ p.initials }}
                <span
                  class="absolute right-[-1px] bottom-[-1px] w-2 h-2 rounded-full"
                  style="background: #1f9d55; border: 2px solid #1e1e23;"
                />
              </span>
              <span class="text-[11.5px] text-[#b7b8c0]">{{ p.name }}</span>
            </span>
            <span class="text-[11.5px] text-[#7e7f8a]">+2 онлайн</span>
          </div>
        </div>

        <div
          class="rounded-2xl p-[13px] flex-1 min-h-0 overflow-auto"
          style="background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06);"
        >
          <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7e7f8a] mb-[9px]">Уведомления</div>
          <div class="flex flex-col gap-0.5">
            <div
              v-for="n in notifs"
              :key="n.id"
              class="flex gap-[10px] items-start p-2 rounded-[10px] cursor-pointer hover:bg-[rgba(255,255,255,0.05)]"
              @click="(e) => markRead(e, n.id)"
            >
              <span
                class="w-[26px] h-[26px] rounded-lg grid place-items-center flex-shrink-0 text-white"
                :style="{ background: n.color }"
              >
                <UIcon :name="resolveIcon(n.iconType)" class="w-[14px] h-[14px]" />
              </span>
              <div class="text-[12px] leading-[1.4] text-[#b7b8c0] min-w-0">
                <b class="text-[#f4f4f6] font-semibold">{{ n.who }}</b> {{ n.txt }}
                <div class="text-[10.5px] text-[#7e7f8a] mt-[1px]">{{ n.t }} назад</div>
              </div>
              <span
                v-if="n.unread"
                class="w-[7px] h-[7px] rounded-full bg-[#ff6a1a] mt-[9px] flex-shrink-0"
              />
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            v-for="action in quickActions"
            :key="action.key"
            class="flex-1 h-[46px] border-none rounded-[13px] cursor-pointer flex flex-col items-center justify-center gap-[3px] text-[9.5px] font-semibold transition-colors"
            :style="actionStyle(action)"
            :title="action.label"
            :aria-label="action.label"
            @click="action.handler"
          >
            <UIcon :name="action.icon" class="w-4 h-4" />
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes cc-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255,106,26,0.5); }
  70% { box-shadow: 0 0 0 6px rgba(255,106,26,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,106,26,0); }
}

.cc-pulse-dot {
  animation: cc-pulse 1.6s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .cc-pulse-dot {
    animation: none;
  }
}
</style>
