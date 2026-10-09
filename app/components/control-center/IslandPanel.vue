<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { TileId } from '#shared/types/control-center'
import type { BoardPulse } from '#shared/types/pulse'

type Notif = {
  id: string
  icon: string
  color: string
  title: string
  why: string
  cta: string
  hasTarget: boolean
  t: string
  unread: boolean
}

export type IslandTab = 'overview' | 'flow' | 'search' | 'notifs'

const props = defineProps<{
  time: string
  weekday: string
  pinned: boolean
  reducedMotion: boolean
  notifs: Notif[]
  focusOn: boolean
  isDark: boolean
  canCreateTask: boolean
  pulse: BoardPulse | null
  pulseLoading: boolean
  overviewTiles: TileId[]
  flowTiles: TileId[]
  boardId: string | null
  boardName: string | null
  boards: { id: string; name: string }[]
  workspaceId: string
}>()

const emit = defineEmits<{
  'toggle-pin': [e: Event]
  'mark-read': [e: Event, id: string]
  'quick-task': [e: Event]
  'quick-search': [e: Event]
  'toggle-focus': [e: Event]
  'toggle-theme': [e: Event]
  logout: [e: Event]
  'select-board': [id: string]
  'search-done': []
}>()

const boardItems = computed<DropdownMenuItem[]>(() =>
  props.boards.map(b => ({
    label: b.name,
    icon: 'i-lucide-kanban-square',
    ...(b.id === props.boardId ? { color: 'primary' as const } : {}),
    onSelect: () => emit('select-board', b.id),
  })),
)

const tab = defineModel<IslandTab>('tab', { default: 'overview' })
const unread = computed(() => props.notifs.filter(n => n.unread).length)

const TABS: { key: IslandTab; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'flow', label: 'Поток' },
  { key: 'search', label: 'Поиск' },
  { key: 'notifs', label: 'Уведомления' },
]
</script>

<template>
  <div class="flex items-center gap-3 px-1 pt-0.5">
    <div class="flex items-baseline gap-[7px] shrink-0">
      <b class="text-[17px] font-semibold tracking-[-0.01em]">{{ time }}</b>
      <span class="text-[var(--island-ink-3)]">·</span>
      <span class="text-[13px] text-[var(--island-ink-3)]">{{ weekday }}</span>
    </div>
    <UDropdownMenu v-if="boards.length > 0" :items="boardItems" :content="{ align: 'start' }">
      <button
        type="button"
        class="h-[28px] max-w-[220px] pl-2.5 pr-2 rounded-lg inline-flex items-center gap-1.5 text-[12px] font-semibold border-none cursor-pointer transition-colors truncate"
        style="background: var(--island-fill); color: var(--island-ink-2);"
        @click.stop
      >
        <UIcon name="i-lucide-kanban-square" class="w-[13px] h-[13px] shrink-0" />
        <span class="truncate">{{ boardName ?? 'Доска' }}</span>
        <UIcon name="i-lucide-chevron-down" class="w-3 h-3 shrink-0" style="color: var(--island-ink-3);" />
      </button>
    </UDropdownMenu>
    <span v-else class="text-[12px] text-[var(--island-ink-3)]">Нет досок</span>
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
      v-for="t in TABS"
      :key="t.key"
      type="button"
      class="flex-1 h-[30px] rounded-lg text-[12px] font-semibold border-none cursor-pointer transition-colors flex items-center justify-center gap-[5px]"
      :style="tab === t.key ? 'background: var(--island-orange-soft); color: var(--island-orange-2);' : 'background: transparent; color: var(--island-ink-3);'"
      @click="tab = t.key"
    >
      {{ t.label }}
      <span
        v-if="t.key === 'notifs' && unread > 0"
        class="min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--island-orange)] text-white text-[9.5px] font-bold flex items-center justify-center"
      >{{ unread > 9 ? '9+' : unread }}</span>
    </button>
  </div>

  <ControlCenterIslandGrid
    v-if="tab === 'overview'"
    :tiles="overviewTiles"
    :pulse="pulse"
    :loading="pulseLoading"
  />

  <ControlCenterIslandGrid
    v-else-if="tab === 'flow'"
    :tiles="flowTiles"
    :pulse="pulse"
    :loading="pulseLoading"
  />

  <ControlCenterSearchTab
    v-else-if="tab === 'search'"
    :workspace-id="workspaceId"
    :board-id="boardId"
    :active="tab === 'search'"
    @done="emit('search-done')"
  />

  <div v-else class="flex-1 min-h-0">
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
    @search="(e) => { e.stopPropagation(); tab = 'search' }"
    @toggle-focus="emit('toggle-focus', $event)"
    @toggle-theme="emit('toggle-theme', $event)"
    @logout="emit('logout', $event)"
  />
</template>
