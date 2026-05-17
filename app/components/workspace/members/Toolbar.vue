<script setup lang="ts">
import type { Role } from '#shared/types/domain'

type RoleCounts = Record<Role | 'all', number>

const props = defineProps<{
  query: string
  roleFilter: Role | 'all'
  counts: RoleCounts
  view: 'grid' | 'list'
}>()

const emit = defineEmits<{
  'update:query': [string]
  'update:roleFilter': [Role | 'all']
  'update:view': ['grid' | 'list']
}>()

const roleChips = computed(() =>
  ROLE_HIERARCHY.filter(r => (props.counts[r] ?? 0) > 0),
)

function selectRole(r: Role | 'all') {
  if (r === 'all') {
    emit('update:roleFilter', 'all')
    return
  }
  emit('update:roleFilter', props.roleFilter === r ? 'all' : r)
}
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <div class="relative flex-1 min-w-[240px] max-w-md">
      <UIcon
        name="i-lucide-search"
        class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none"
      />
      <input
        :value="query"
        type="text"
        placeholder="Поиск по имени, email, должности..."
        class="w-full h-9 pl-9 pr-3 rounded-md border border-default bg-default text-sm text-default placeholder:text-muted focus:outline-none focus:border-accent-500"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="inline-flex gap-1 rounded-md border border-default bg-default p-0.5">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-colors whitespace-nowrap"
        :class="roleFilter === 'all'
          ? 'bg-primary text-inverted'
          : 'text-muted hover:text-default'"
        @click="selectRole('all')"
      >
        Все
        <span
          class="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] tabular-nums"
          :class="roleFilter === 'all'
            ? 'bg-white/15 text-inverted/85'
            : 'bg-elevated text-muted'"
        >{{ counts.all }}</span>
      </button>
      <button
        v-for="r in roleChips"
        :key="r"
        type="button"
        class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-colors whitespace-nowrap"
        :class="roleFilter === r
          ? 'bg-primary text-inverted'
          : 'text-muted hover:text-default'"
        @click="selectRole(r)"
      >
        <span class="size-1.5 rounded-full" :class="ROLE_DOT_CLASS[r]" />
        {{ ROLE_LABEL[r] }}
        <span
          class="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] tabular-nums"
          :class="roleFilter === r
            ? 'bg-white/15 text-inverted/85'
            : 'bg-elevated text-muted'"
        >{{ counts[r] }}</span>
      </button>
    </div>

    <div class="ml-auto inline-flex gap-0.5 rounded-md border border-default bg-default p-0.5">
      <button
        type="button"
        title="Карточки"
        class="inline-flex size-7 items-center justify-center rounded transition-colors"
        :class="view === 'grid' ? 'bg-elevated text-default' : 'text-muted hover:text-default'"
        @click="emit('update:view', 'grid')"
      >
        <UIcon name="i-lucide-layout-grid" class="size-3.5" />
      </button>
      <button
        type="button"
        title="Список"
        class="inline-flex size-7 items-center justify-center rounded transition-colors"
        :class="view === 'list' ? 'bg-elevated text-default' : 'text-muted hover:text-default'"
        @click="emit('update:view', 'list')"
      >
        <UIcon name="i-lucide-list" class="size-3.5" />
      </button>
    </div>
  </div>
</template>
