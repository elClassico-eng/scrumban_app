<script setup lang="ts">
import type { ServiceClass } from '#shared/types/domain'
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'

const props = defineProps<{
  task: Task
  currentColumn: BoardColumn | null
  columns: BoardColumn[]
}>()

const emit = defineEmits<{
  'column-change': [columnId: string]
  'class-change': [value: ServiceClass]
  'title-change': [value: string]
}>()

const CLASS_ICON: Record<ServiceClass, string> = {
  standard: 'i-lucide-flag',
  expedite: 'i-lucide-zap',
  intangible: 'i-lucide-circle',
  fixed_date: 'i-lucide-calendar-clock',
}

const CLASS_VARIANT: Record<ServiceClass, string> = {
  standard: 'bg-default text-default border-default',
  expedite: 'bg-accent-500 text-white border-accent-500',
  intangible: 'bg-default text-muted border-default',
  fixed_date: 'bg-default text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
}

const classOptions = computed(() =>
  (Object.entries(SERVICE_CLASS_INFO) as [ServiceClass, typeof SERVICE_CLASS_INFO[ServiceClass]][])
    .map(([value, info]) => ({
      label: info.shortLabel,
      icon: CLASS_ICON[value],
      onSelect: () => emit('class-change', value),
    })),
)

const columnOptions = computed(() =>
  props.columns.map(c => ({ label: c.name, onSelect: () => emit('column-change', c.id) })),
)

function onTitleBlur(e: FocusEvent) {
  const next = (e.target as HTMLElement).textContent?.trim() ?? ''
  if (next && next !== props.task.title) emit('title-change', next)
}
</script>

<template>
  <div class="px-7 pt-[22px] pb-3.5 border-b border-default">
    <div class="flex items-center gap-2 mb-3.5 flex-wrap">
      <UDropdownMenu :items="columnOptions">
        <button
          type="button"
          class="inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-md bg-inverted text-inverted text-[12.5px] font-medium cursor-pointer"
        >
          <span class="size-1.5 rounded-full bg-accent-500" />
          {{ currentColumn?.name ?? '—' }}
          <UIcon name="i-lucide-chevron-down" class="size-3 opacity-60" />
        </button>
      </UDropdownMenu>

      <UDropdownMenu :items="classOptions">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12.5px] font-medium cursor-pointer border transition-colors"
          :class="CLASS_VARIANT[task.serviceClass]"
        >
          <UIcon :name="CLASS_ICON[task.serviceClass]" class="size-3.5" />
          {{ SERVICE_CLASS_INFO[task.serviceClass].shortLabel }}
          <UIcon name="i-lucide-chevron-down" class="size-3 opacity-60" />
        </button>
      </UDropdownMenu>

      <span
        v-if="task.isEpic"
        class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-inverted text-accent-500 text-[12px] font-semibold uppercase tracking-[0.04em] border border-inverted"
      >
        <UIcon name="i-lucide-crown" class="size-3.5" />
        Epic
      </span>
    </div>

    <h1
      class="font-semibold tracking-tight text-default leading-tight outline-none rounded-md py-1 px-1.5 -mx-1.5 hover:bg-elevated focus:bg-elevated focus:ring-2 focus:ring-accent-100 transition-colors"
      :class="task.isEpic ? 'text-[26px]' : 'text-2xl'"
      :contenteditable="true"
      spellcheck="false"
      @blur="onTitleBlur"
      @keydown.enter.prevent="($event.target as HTMLElement).blur()"
    >
      {{ task.title }}
    </h1>
  </div>
</template>