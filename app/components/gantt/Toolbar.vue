<script setup lang="ts">
import type { GanttZoom } from '~/utils/gantt'

defineProps<{
  zoom: GanttZoom
  mode: 'cpm' | 'fact'
  cpmAvailable: boolean
  sprintName: string | null
  summary: { p50: number, p85: number, prob: number | null } | null
}>()

const emit = defineEmits<{
  'update:zoom': [value: GanttZoom]
  'update:mode': [value: 'cpm' | 'fact']
}>()

const ZOOMS: Array<{ value: GanttZoom, label: string }> = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
]
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-3 min-w-0">
      <h2 class="text-base font-semibold truncate">
        <template v-if="mode === 'cpm' && sprintName">План спринта «{{ sprintName }}»</template>
        <template v-else-if="sprintName">Факт — «{{ sprintName }}»</template>
        <template v-else>Timeline</template>
      </h2>
      <span
        v-if="summary"
        class="hidden md:inline-flex items-center gap-2 text-xs text-muted whitespace-nowrap"
      >
        <span class="inline-flex items-center gap-1">
          <span class="size-1.5 rounded-full bg-accent-500" />P50 {{ summary.p50 }}д
        </span>
        <span>· P85 {{ summary.p85 }}д</span>
        <span v-if="summary.prob != null">· уложимся в горизонт: {{ Math.round(summary.prob * 100) }}%</span>
      </span>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <div v-if="cpmAvailable" class="flex items-center rounded-lg bg-elevated p-0.5">
        <button
          v-for="m in (['cpm', 'fact'] as const)"
          :key="m"
          type="button"
          class="px-2.5 py-1 text-xs rounded-md transition-colors"
          :class="mode === m ? 'bg-default shadow-sm text-default' : 'text-muted hover:text-default'"
          @click="emit('update:mode', m)"
        >
          {{ m === 'cpm' ? 'План' : 'Факт' }}
        </button>
      </div>
      <div class="flex items-center rounded-lg bg-elevated p-0.5">
        <button
          v-for="z in ZOOMS"
          :key="z.value"
          type="button"
          class="px-2.5 py-1 text-xs rounded-md transition-colors"
          :class="zoom === z.value ? 'bg-default shadow-sm text-default' : 'text-muted hover:text-default'"
          @click="emit('update:zoom', z.value)"
        >
          {{ z.label }}
        </button>
      </div>
    </div>
  </div>
</template>
