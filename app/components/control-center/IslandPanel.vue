<script setup lang="ts">
type Person = {
  id: string
  name: string
  color: string
  initials: string
  avatarUrl?: string | null
}

type Notif = {
  id: string
  iconType: 'at' | 'move' | 'check' | 'alert' | 'refresh' | 'trend'
  color: string
  who: string
  txt: string
  t: string
  unread: boolean
}

const props = defineProps<{
  time: string
  weekday: string
  pinned: boolean
  reducedMotion: boolean
  timerTaskId: string
  timerTaskTitle: string
  seconds: number
  running: boolean
  timerActive: boolean
  sprintPct: number
  sprintCaption: string
  sprintActive: boolean
  people: Person[]
  presenceExtra: number
  notifs: Notif[]
  focusOn: boolean
  isDark: boolean
  canCreateTask: boolean
  sleLabel?: string | null
  replenishmentLabel?: string | null
  replenishmentOverdue?: boolean
  hasBoardMetrics?: boolean
  replenishmentClickable?: boolean
}>()

const emit = defineEmits<{
  'toggle-pin': [e: Event]
  'toggle-running': [e: Event]
  'stop-timer': [e: Event]
  'mark-read': [e: Event, id: string]
  'quick-task': [e: Event]
  'quick-search': [e: Event]
  'toggle-focus': [e: Event]
  'toggle-theme': [e: Event]
  logout: [e: Event]
  'view-all': [e: Event]
  'mark-replenishment': [e: Event]
}>()

const tab = ref<'overview' | 'notifs'>('overview')
const unread = computed(() => props.notifs.filter(n => n.unread).length)
</script>

<template>
  <div class="flex items-center gap-3 px-1 pt-0.5">
    <div class="flex items-baseline gap-[7px]">
      <b class="text-[17px] font-semibold tracking-[-0.01em]">{{ time }}</b>
      <span class="text-[var(--island-ink-3)]">·</span>
      <span class="text-[13px] text-[var(--island-ink-3)]">{{ weekday }}</span>
    </div>
    <div class="flex-1" />
    <button
      class="w-[30px] h-[30px] rounded-lg grid place-items-center border-none cursor-pointer transition-colors"
      :style="pinned ? 'background: var(--island-orange-soft); color: var(--island-orange-2);' : 'background: var(--island-fill); color: var(--island-ink-3);'"
      title="Закрепить"
      aria-label="Закрепить"
      @click="emit('toggle-pin', $event)"
    >
      <UIcon name="i-lucide-pin" class="w-[15px] h-[15px]" />
    </button>
  </div>

  <div
    class="rounded-xl p-[3px] flex gap-[2px]"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <button
      type="button"
      class="flex-1 h-[30px] rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-colors"
      :style="tab === 'overview' ? 'background: var(--island-orange-soft); color: var(--island-orange-2);' : 'background: transparent; color: var(--island-ink-3);'"
      @click="tab = 'overview'"
    >
      Обзор
    </button>
    <button
      type="button"
      class="flex-1 h-[30px] rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-colors flex items-center justify-center gap-[5px]"
      :style="tab === 'notifs' ? 'background: var(--island-orange-soft); color: var(--island-orange-2);' : 'background: transparent; color: var(--island-ink-3);'"
      @click="tab = 'notifs'"
    >
      Уведомления
      <span
        v-if="unread > 0"
        class="min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--island-orange)] text-white text-[9.5px] font-bold flex items-center justify-center"
      >{{ unread > 9 ? '9+' : unread }}</span>
    </button>
  </div>

  <div v-show="tab === 'overview'" class="flex-1 min-h-0 flex flex-col gap-[10px]">
    <div class="grid gap-[10px]" style="grid-template-columns: 1.5fr 1fr;">
      <ControlCenterTaskTimerTile
        :task-id="timerTaskId"
        :task-title="timerTaskTitle"
        :seconds="seconds"
        :running="running"
        :active="timerActive"
        @toggle="emit('toggle-running', $event)"
        @stop="emit('stop-timer', $event)"
      />
      <ControlCenterSprintRingTile
        :pct="sprintPct"
        :caption="sprintCaption"
        :active="sprintActive"
        :reduced-motion="reducedMotion"
      />
    </div>
    <div class="flex flex-wrap gap-[10px]">
      <template v-if="hasBoardMetrics">
        <ControlCenterMetricTile
          icon="i-lucide-sparkles"
          label="SLE"
          :value="sleLabel ?? '—'"
          accent
          :info="{
            answers: 'Service Level Expectation. Читается как «N% задач закрывается за ≤ M дней» — перцентиль времени выполнения по закрытым задачам доски.',
            action: 'От этого порога краснеют зависшие карточки на доске (aging). Пересчитать из истории — в настройках доски.',
          }"
        />
        <ControlCenterMetricTile
          icon="i-lucide-calendar"
          label="Пополнение"
          :value="replenishmentLabel ?? '—'"
          :accent="replenishmentOverdue"
          :clickable="replenishmentClickable"
          @click="(e) => emit('mark-replenishment', e)"
        />
      </template>
      <ControlCenterPresenceTile
        :people="people"
        :extra="presenceExtra"
        @view-all="(e) => emit('view-all', e)"
      />
    </div>
  </div>

  <div v-show="tab === 'notifs'" class="flex-1 min-h-0">
    <ControlCenterNotifsTile
      class="h-full min-h-0"
      :notifs="notifs"
      @read="(e, id) => emit('mark-read', e, id)"
    />
  </div>

  <ControlCenterQuickActions
    :focus-on="focusOn"
    :is-dark="isDark"
    :can-create-task="canCreateTask"
    @task="emit('quick-task', $event)"
    @search="emit('quick-search', $event)"
    @toggle-focus="emit('toggle-focus', $event)"
    @toggle-theme="emit('toggle-theme', $event)"
    @logout="emit('logout', $event)"
  />
</template>
