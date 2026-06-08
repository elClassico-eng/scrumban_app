<script setup lang="ts">
import type { MemberView } from '#shared/types/workspace'

type SwimlaneMode = 'none' | 'assignee' | 'service_class' | 'epic'
type ClassFilter = 'all' | 'expedite' | 'blocker'

const props = defineProps<{
  swimlane: SwimlaneMode
  query: string
  selectedAssignees: Set<string>
  classFilter: ClassFilter
  members: MemberView[]
  expediteCount: number
  blockerCount: number
  canCreate: boolean
}>()

const emit = defineEmits<{
  'update:swimlane': [value: SwimlaneMode]
  'update:query': [value: string]
  'toggle-assignee': [userId: string | null]
  'update:classFilter': [value: ClassFilter]
  'create-task': []
}>()

const SWIMLANE_OPTIONS: Array<{ key: SwimlaneMode; label: string }> = [
  { key: 'none', label: 'Без группировки' },
  { key: 'assignee', label: 'По исполнителю' },
  { key: 'service_class', label: 'По классу' },
  { key: 'epic', label: 'По эпику' },
]

const groupMenu = computed(() =>
  SWIMLANE_OPTIONS.map(opt => ({
    label: opt.label,
    icon: props.swimlane === opt.key ? 'i-lucide-check' : undefined,
    onSelect: () => emit('update:swimlane', opt.key),
  })),
)

const swimlaneLabel = computed(() =>
  SWIMLANE_OPTIONS.find(o => o.key === props.swimlane)?.label ?? '—',
)

const visibleMembers = computed(() => props.members.slice(0, 8))
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-2.5 bg-default border-b border-default flex-wrap">
    <UDropdownMenu :items="groupMenu" :ui="{ content: 'w-48' }">
      <button
        type="button"
        class="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-default bg-default text-[13px] text-default hover:border-zinc-400 cursor-pointer transition-colors"
      >
        <span class="text-muted">Группировка:</span>
        <span class="font-medium">{{ swimlaneLabel }}</span>
        <UIcon name="i-lucide-chevron-down" class="size-3.5 text-muted" />
      </button>
    </UDropdownMenu>

    <div class="relative">
      <UIcon
        name="i-lucide-search"
        class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none"
      />
      <input
        :value="query"
        type="search"
        placeholder="Найти задачу…"
        class="h-8 w-[220px] pl-8 pr-3 rounded-md bg-muted border border-transparent text-[13px] text-default placeholder:text-muted focus:outline-none focus:border-accent-500 focus:bg-default transition-colors"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div
      v-if="members.length > 0"
      class="inline-flex items-center bg-default border border-default rounded-full px-1 py-0.5 gap-px"
    >
      <button
        type="button"
        :class="[
          'h-6 px-2 rounded-full text-[11px] font-semibold transition-all cursor-pointer',
          selectedAssignees.size === 0
            ? 'bg-elevated text-default'
            : 'text-muted hover:bg-muted',
        ]"
        title="Все"
        @click="emit('toggle-assignee', null)"
      >
        Все
      </button>
      <button
        v-for="m in visibleMembers"
        :key="m.userId"
        type="button"
        :class="[
          'relative size-6 rounded-full grid place-items-center transition-all cursor-pointer -ml-1.5 first:ml-0',
          selectedAssignees.size > 0 && !selectedAssignees.has(m.userId) ? 'opacity-40 grayscale' : '',
          selectedAssignees.has(m.userId) ? 'ring-2 ring-accent-500 z-10' : '',
        ]"
        :title="displayName(m)"
        @click="emit('toggle-assignee', m.userId)"
      >
        <UserAvatar :user="m" size="sm" />
      </button>
    </div>

    <button
      type="button"
      :class="[
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] cursor-pointer transition-colors',
        classFilter === 'expedite'
          ? 'bg-inverted text-inverted border-brand-500'
          : 'bg-default text-default border-default hover:border-zinc-400',
      ]"
      @click="emit('update:classFilter', classFilter === 'expedite' ? 'all' : 'expedite')"
    >
      <UIcon
        name="i-lucide-zap"
        :class="['size-3.5', classFilter === 'expedite' ? 'text-accent-500' : 'text-muted']"
      />
      <span>Срочные</span>
      <span
        :class="[
          'px-1.5 h-4 min-w-[16px] grid place-items-center rounded-full text-[10.5px] tabular-nums',
          classFilter === 'expedite'
            ? 'bg-white/15 text-white/85'
            : 'bg-elevated text-muted',
        ]"
      >{{ expediteCount }}</span>
    </button>

    <button
      type="button"
      :class="[
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] cursor-pointer transition-colors',
        classFilter === 'blocker'
          ? 'bg-inverted text-inverted border-brand-500'
          : 'bg-default text-default border-default hover:border-zinc-400',
      ]"
      @click="emit('update:classFilter', classFilter === 'blocker' ? 'all' : 'blocker')"
    >
      <UIcon
        name="i-lucide-alert-triangle"
        :class="['size-3.5', classFilter === 'blocker' ? 'text-accent-500' : 'text-muted']"
      />
      <span>С блокерами</span>
      <span
        :class="[
          'px-1.5 h-4 min-w-[16px] grid place-items-center rounded-full text-[10.5px] tabular-nums',
          classFilter === 'blocker'
            ? 'bg-white/15 text-white/85'
            : 'bg-elevated text-muted',
        ]"
      >{{ blockerCount }}</span>
    </button>

    <div class="flex-1" />

    <button
      v-if="canCreate"
      type="button"
      class="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-inverted hover:bg-accent-500 text-inverted hover:text-white text-[13px] font-medium cursor-pointer transition-colors"
      @click="emit('create-task')"
    >
      <UIcon name="i-lucide-plus" class="size-3.5" />
      Новая задача
    </button>
  </div>
</template>