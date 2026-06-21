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

const DAY = 86_400_000

const barColor = computed(() =>
  props.row.critical ? 'bg-accent-500' : SERVICE_CLASS_INFO[props.row.serviceClass].dotClass,
)

function fmt(d: Date) {
  return d.toLocaleDateString('ru', { day: '2-digit', month: 'short' })
}

const durationDays = computed(() =>
  Math.max(1, Math.round((props.row.end.getTime() - props.row.start.getTime()) / DAY)),
)
const slackDays = computed(() =>
  props.row.slackEnd ? Math.round((props.row.slackEnd.getTime() - props.row.end.getTime()) / DAY) : 0,
)
const dateRange = computed(() => `${fmt(props.row.start)} → ${fmt(props.row.end)}`)
</script>

<template>
  <div class="relative" :style="{ height: `${rowHeight}px` }">
    <div
      v-if="layout.slackWidth > 0"
      class="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full opacity-25"
      :class="barColor"
      :style="{ left: `${layout.x + layout.width}px`, width: `${layout.slackWidth}px` }"
    />
    <div
      class="absolute top-1/2 -translate-y-1/2 h-5"
      :style="{ left: `${layout.x}px`, width: `${layout.width}px` }"
    >
      <UPopover
        mode="hover"
        class="block w-full h-full"
        :open-delay="120"
        :close-delay="0"
        :content="{ side: 'top', align: 'start' }"
      >
        <button
          type="button"
          class="w-full h-full rounded-md transition-opacity hover:opacity-90 focus:outline-none"
          :class="[barColor, row.critical ? 'ring-1 ring-accent-600' : '']"
          @click="emit('open', row.taskId)"
        />
        <template #content>
          <div class="p-2.5 max-w-[16rem] space-y-1">
            <p class="font-medium text-sm text-default">{{ row.title }}</p>
            <p class="text-xs text-muted">{{ dateRange }} · {{ durationDays }} дн</p>
            <p
              v-if="row.critical"
              class="text-xs inline-flex items-center gap-1 text-accent-600 dark:text-accent-400 font-medium"
            >
              <span class="size-1.5 rounded-full bg-accent-500" />На критическом пути
            </p>
            <p v-else-if="slackDays > 0" class="text-xs text-muted">
              Резерв {{ slackDays }} дн — можно сдвинуть без срыва спринта
            </p>
          </div>
        </template>
      </UPopover>
    </div>
  </div>
</template>
