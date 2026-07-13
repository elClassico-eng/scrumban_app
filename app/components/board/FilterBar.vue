<script setup lang="ts">
import type { MemberView } from '#shared/types/workspace'
import { ROLE_LABEL } from '~/utils/role-labels'

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
  'open-daily': []
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

const mobileOpen = ref(false)
const activeCount = computed(() =>
  (props.swimlane !== 'none' ? 1 : 0)
  + (props.query.trim() ? 1 : 0)
  + (props.selectedAssignees.size > 0 ? 1 : 0)
  + (props.classFilter !== 'all' ? 1 : 0),
)
</script>

<template>
  <div class="bg-default border-b border-default sticky top-0 lg:top-[60px] z-10">
    <div class="lg:hidden flex items-center gap-2 px-4 py-2.5">
      <button
        type="button"
        :class="[
          'inline-flex items-center gap-2 h-9 px-3.5 rounded-md border text-[13px] cursor-pointer transition-colors',
          mobileOpen || activeCount > 0
            ? 'border-accent-500 text-accent-600 bg-accent-50'
            : 'border-default text-default bg-default/70 hover:border-zinc-400',
        ]"
        @click="mobileOpen = !mobileOpen"
      >
        <UIcon name="i-lucide-sliders-horizontal" class="size-4" />
        <span class="font-medium">Фильтры</span>
        <span
          v-if="activeCount > 0"
          class="min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-accent-500 text-white text-[10.5px] font-bold tabular-nums"
        >{{ activeCount }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          :class="['size-3.5 text-muted transition-transform', mobileOpen ? 'rotate-180' : '']"
        />
      </button>

      <div class="flex-1" />

      <button
        type="button"
        class="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-default text-muted hover:text-default hover:border-accent-500 text-[13px] font-medium cursor-pointer transition-colors"
        title="Дейли: повестка дня по доске"
        @click="emit('open-daily')"
      >
        <UIcon name="i-lucide-sunrise" class="size-3.5" />
        Дейли
      </button>

      <button
        v-if="canCreate"
        type="button"
        class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-inverted hover:bg-accent-500 text-inverted hover:text-white text-[13px] font-medium cursor-pointer transition-colors"
        @click="emit('create-task')"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
        Новая задача
      </button>
    </div>

    <div
      :class="[
        'lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:gap-2 lg:px-4 lg:py-2.5 lg:border-t-0',
        'max-lg:flex-col max-lg:items-stretch max-lg:gap-3 max-lg:px-4 max-lg:py-3 max-lg:border-t max-lg:border-default',
        mobileOpen ? 'max-lg:flex' : 'max-lg:hidden',
      ]"
    >
      <UDropdownMenu :items="groupMenu" :ui="{ content: 'w-48' }">
        <button
          type="button"
          class="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-default bg-default/70 text-[13px] text-default hover:border-zinc-400 cursor-pointer transition-colors max-lg:w-full max-lg:justify-start"
        >
          <span class="text-muted">Группировка:</span>
          <span class="font-medium">{{ swimlaneLabel }}</span>
          <UIcon name="i-lucide-chevron-down" class="size-3.5 text-muted" />
        </button>
      </UDropdownMenu>

      <div class="relative w-full sm:w-auto">
        <UIcon
          name="i-lucide-search"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none"
        />
        <input
          :value="query"
          type="search"
          placeholder="Найти задачу…"
          class="h-8 w-full sm:w-[220px] pl-8 pr-3 rounded-md bg-muted border border-transparent text-[13px] text-default placeholder:text-muted focus:outline-none focus:border-accent-500 focus:bg-default transition-colors"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        >
      </div>

      <div
        v-if="members.length > 0"
        class="inline-flex items-center bg-default border border-default rounded-full px-1 py-0.5 gap-px max-lg:w-full max-lg:overflow-x-auto"
      >
        <button
          type="button"
          :class="[
            'h-6 px-2 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0',
            selectedAssignees.size === 0
              ? 'bg-elevated text-default'
              : 'text-muted hover:bg-muted',
          ]"
          title="Все"
          @click="emit('toggle-assignee', null)"
        >
          Все
        </button>
        <UiAvatarTooltipWrap
          v-for="m in visibleMembers"
          :key="m.userId"
          :name="displayName(m)"
          :designation="ROLE_LABEL[m.role]"
          class="-ml-1.5 first:ml-0 shrink-0"
        >
          <button
            type="button"
            :class="[
              'relative size-6 rounded-full grid place-items-center transition-all cursor-pointer',
              selectedAssignees.size > 0 && !selectedAssignees.has(m.userId) ? 'opacity-40 grayscale' : '',
              selectedAssignees.has(m.userId) ? 'ring-2 ring-accent-500 z-10' : '',
            ]"
            @click="emit('toggle-assignee', m.userId)"
          >
            <UserAvatar :user="m" size="sm" />
          </button>
        </UiAvatarTooltipWrap>
      </div>

      <button
        type="button"
        :class="[
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] cursor-pointer transition-colors',
          classFilter === 'expedite'
            ? 'bg-inverted text-inverted border-brand-500'
            : 'bg-default/70 text-default border-default hover:border-zinc-400',
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
            : 'bg-default/70 text-default border-default hover:border-zinc-400',
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

      <div class="hidden lg:block lg:flex-1" />

      <button
        type="button"
        class="hidden lg:inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-default text-muted hover:text-default hover:border-accent-500 text-[13px] font-medium cursor-pointer transition-colors"
        title="Дейли: повестка дня по доске"
        @click="emit('open-daily')"
      >
        <UIcon name="i-lucide-sunrise" class="size-3.5" />
        Дейли
      </button>

      <button
        v-if="canCreate"
        type="button"
        class="hidden lg:inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-inverted hover:bg-accent-500 text-inverted hover:text-white text-[13px] font-medium cursor-pointer transition-colors"
        @click="emit('create-task')"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
        Новая задача
      </button>
    </div>
  </div>
</template>
