<script setup lang="ts">
import type { FocusTab } from './types'

defineProps<{
  current: FocusTab
  counts: Record<Exclude<FocusTab, 'desc'>, number>
  hasBlocker: boolean
}>()

defineEmits<{
  'update:current': [tab: FocusTab]
}>()

const TABS: { id: FocusTab; label: string; icon: string }[] = [
  { id: 'desc', label: 'Описание', icon: 'i-lucide-align-left' },
  { id: 'checks', label: 'Чек-листы', icon: 'i-lucide-check-square' },
  { id: 'deps', label: 'Связи', icon: 'i-lucide-link' },
  { id: 'comments', label: 'Комментарии', icon: 'i-lucide-message-square' },
  { id: 'activity', label: 'История', icon: 'i-lucide-history' },
]
</script>

<template>
  <div class="flex gap-0.5 px-7 border-b border-default shrink-0" role="tablist">
    <button
      v-for="t in TABS"
      :key="t.id"
      type="button"
      role="tab"
      class="relative h-10 px-3.5 inline-flex items-center gap-[7px] text-[13px] font-medium cursor-pointer transition-colors"
      :class="current === t.id ? 'text-default' : 'text-muted hover:text-default'"
      @click="$emit('update:current', t.id)"
    >
      <UIcon :name="t.icon" class="size-3.5" />
      {{ t.label }}
      <span
        v-if="t.id !== 'desc' && counts[t.id as Exclude<FocusTab, 'desc'>] > 0"
        class="rounded-full px-1.5 py-px text-[11px] tabular-nums"
        :class="current === t.id ? 'bg-accent-50 text-accent-600' : 'bg-zinc-100 text-muted'"
      >
        {{ counts[t.id as Exclude<FocusTab, 'desc'>] }}
      </span>
      <span
        v-if="t.id === 'deps' && hasBlocker"
        class="size-1.5 rounded-full bg-red-500 -ml-0.5"
      />
      <span
        v-if="current === t.id"
        class="absolute inset-x-2 -bottom-px h-0.5 bg-accent-500 rounded-sm"
      />
    </button>
  </div>
</template>