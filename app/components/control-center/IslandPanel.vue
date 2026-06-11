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

defineProps<{
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
}>()
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
      :style="pinned ? 'background: rgba(255,106,26,0.2); color: var(--island-orange-2);' : 'background: rgba(255,255,255,0.06); color: var(--island-ink-3);'"
      title="Закрепить"
      aria-label="Закрепить"
      @click="emit('toggle-pin', $event)"
    >
      <UIcon name="i-lucide-pin" class="w-[15px] h-[15px]" />
    </button>
  </div>

  <div class="grid gap-[10px] flex-1 min-h-0" style="grid-template-columns: 1fr 1fr;">
    <div class="flex flex-col gap-[10px] min-h-0 overflow-hidden">
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
      <ControlCenterPresenceTile
        :people="people"
        :extra="presenceExtra"
        @view-all="(e) => emit('view-all', e)"
      />
    </div>
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
