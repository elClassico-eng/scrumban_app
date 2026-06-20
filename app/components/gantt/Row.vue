<script setup lang="ts">
import type { GanttRow, RowLayout } from '~/utils/gantt'

const props = defineProps<{
  row: GanttRow
  layout: RowLayout
  rowHeight: number
}>()

const emit = defineEmits<{
  open: [taskId: string]
}>()

const barColor = computed(() =>
  props.row.critical ? 'bg-accent-500' : SERVICE_CLASS_INFO[props.row.serviceClass].dotClass,
)
</script>

<template>
  <div class="relative" :style="{ height: `${rowHeight}px` }">
    <div
      v-if="layout.slackWidth > 0"
      class="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-r-sm opacity-30"
      :class="barColor"
      :style="{ left: `${layout.x + layout.width}px`, width: `${layout.slackWidth}px` }"
    />
    <button
      type="button"
      class="absolute top-1/2 -translate-y-1/2 h-5 rounded-md transition-opacity hover:opacity-90 focus:outline-none"
      :class="[barColor, row.critical ? 'ring-1 ring-accent-600' : '']"
      :style="{ left: `${layout.x}px`, width: `${layout.width}px` }"
      :title="row.title"
      @click="emit('open', row.taskId)"
    />
  </div>
</template>
