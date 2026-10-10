<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ControlCenterTab, TileId } from '#shared/types/control-center'
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
  pulseError: boolean
  searchFocusTick: number
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
  'update-tiles': [tab: ControlCenterTab, tiles: TileId[]]
}>()


const gridStatus = computed<'ok' | 'loading' | 'noBoard' | 'error'>(() => {
  if (!props.boardId) return 'noBoard'
  if (props.pulseError) return 'error'
  if (props.pulseLoading && !props.pulse) return 'loading'
  return 'ok'
})

const boardItems = computed<DropdownMenuItem[]>(() =>
  props.boards.map(b => ({
    label: b.name,
    icon: 'i-lucide-kanban-square',
    ...(b.id === props.boardId ? { color: 'primary' as const } : {}),
    onSelect: () => emit('select-board', b.id),
  })),
)

const tab = defineModel<IslandTab>('tab', { default: 'overview' })

const editing = ref<ControlCenterTab | null>(null)
const canEdit = computed(() => tab.value === 'overview' || tab.value === 'flow')
watch(tab, () => { editing.value = null })
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
    <div class="flex items-baseline gap-[7px] min-w-0">
      <b class="text-[17px] font-semibold tracking-[-0.01em] shrink-0">{{ time }}</b>
      <span class="text-[var(--island-ink-3)]">·</span>
      <span class="text-[13px] text-[var(--island-ink-3)] shrink-0">{{ weekday }}</span>
      <template v-if="boards.length > 0">
        <span class="text-[var(--island-ink-3)]">·</span>
        <UDropdownMenu :items="boardItems" :content="{ align: 'start' }">
          <button
            type="button"
            class="min-w-0 max-w-[240px] inline-flex items-baseline gap-1 text-[13px] leading-none border-none bg-transparent p-0 cursor-pointer transition-colors hover:text-[var(--island-ink)]"
            style="color: var(--island-ink-3);"
            title="Сменить доску"
            @click.stop
          >
            <span class="shrink-0">текущая доска:</span>
            <span class="truncate text-[var(--island-ink-2)]">{{ boardName ?? '—' }}</span>
            <UIcon name="i-lucide-chevron-down" class="w-3 h-3 shrink-0 self-center" />
          </button>
        </UDropdownMenu>
      </template>
      <template v-else>
        <span class="text-[var(--island-ink-3)]">·</span>
        <span class="text-[13px] text-[var(--island-ink-3)]">нет досок</span>
      </template>
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
    <button
      v-if="canEdit"
      type="button"
      class="w-[30px] h-[30px] rounded-lg grid place-items-center border-none cursor-pointer transition-colors shrink-0"
      :style="editing ? 'background: var(--island-orange-soft); color: var(--island-orange-2);' : 'background: transparent; color: var(--island-ink-3);'"
      title="Настроить плитки"
      aria-label="Настроить плитки"
      @click.stop="editing = editing ? null : (tab as ControlCenterTab)"
    >
      <UIcon name="i-lucide-settings-2" class="w-[15px] h-[15px]" />
    </button>
  </div>

  <ControlCenterGridEditor
    v-if="editing && (tab === 'overview' || tab === 'flow')"
    :tab="editing"
    :tiles="editing === 'overview' ? overviewTiles : flowTiles"
    :reduced-motion="reducedMotion"
    @update:tiles="(t) => emit('update-tiles', editing!, t)"
    @done="editing = null"
  />

  <ControlCenterIslandGrid
    v-else-if="tab === 'overview'"
    :tiles="overviewTiles"
    :pulse="pulse"
    :loading="pulseLoading"
    :status="gridStatus"
  />

  <ControlCenterIslandGrid
    v-else-if="tab === 'flow'"
    :tiles="flowTiles"
    :pulse="pulse"
    :loading="pulseLoading"
    :status="gridStatus"
  />

  <ControlCenterSearchTab
    v-else-if="tab === 'search'"
    :workspace-id="workspaceId"
    :board-id="boardId"
    :active="tab === 'search'"
    :focus-tick="searchFocusTick"
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
