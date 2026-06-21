<script setup lang="ts">
import { addDays, type GanttRow, type GanttZoom } from '~/utils/gantt'

const props = defineProps<{
  rows: GanttRow[]
  range: { start: Date, end: Date }
  zoom: GanttZoom
  now: Date
  anchor: Date
  horizonDays: number | null
}>()

const emit = defineEmits<{
  'open-task': [taskId: string]
}>()

const ROW_HEIGHT = 40
const LABEL_W = 200

const scale = computed(() => timeScale(props.range.start, PX_PER_DAY[props.zoom]))
const laneWidth = computed(() => scale.value.xOf(props.range.end) + 24)
const laneHeight = computed(() => props.rows.length * ROW_HEIGHT)
const layout = computed(() => layoutRows(props.rows, scale.value, ROW_HEIGHT))
const segments = computed(() => edgeSegments(props.rows, layout.value))
const ticks = computed(() => axisTicks(props.range.start, props.range.end, props.zoom))
const todayX = computed(() => scale.value.xOf(props.now))
const horizonX = computed(() =>
  props.horizonDays != null ? scale.value.xOf(addDays(props.anchor, props.horizonDays)) : null,
)

const axisEl = ref<HTMLElement>()
const laneEl = ref<HTMLElement>()
function onLaneScroll() {
  if (axisEl.value && laneEl.value) axisEl.value.scrollLeft = laneEl.value.scrollLeft
}
</script>

<template>
  <div class="flex flex-col max-h-full border border-default rounded-lg overflow-hidden">
    <div class="flex shrink-0 border-b border-default bg-elevated/40">
      <div class="shrink-0 border-r border-default" :style="{ width: `${LABEL_W}px` }" />
      <div ref="axisEl" class="flex-1 overflow-hidden">
        <div class="relative h-9" :style="{ width: `${laneWidth}px` }">
          <div
            v-for="(t, i) in ticks"
            :key="i"
            class="absolute bottom-1.5 -translate-x-1/2 text-[11px] whitespace-nowrap tabular-nums"
            :class="t.major ? 'text-default font-medium' : 'text-muted'"
            :style="{ left: `${t.x}px` }"
          >
            {{ t.label }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto flex">
      <div class="shrink-0 border-r border-default" :style="{ width: `${LABEL_W}px` }">
        <button
          v-for="r in rows"
          :key="r.taskId"
          type="button"
          class="w-full flex items-center px-3 border-b border-default/40 text-sm text-left truncate hover:bg-elevated transition-colors"
          :style="{ height: `${ROW_HEIGHT}px` }"
          :title="r.title"
          @click="emit('open-task', r.taskId)"
        >
          <span class="truncate">{{ r.title }}</span>
        </button>
      </div>

      <div ref="laneEl" class="flex-1 overflow-x-auto" @scroll="onLaneScroll">
        <div class="relative" :style="{ width: `${laneWidth}px`, height: `${laneHeight}px` }">
          <div
            v-for="(t, i) in ticks"
            :key="`g${i}`"
            class="absolute top-0 bottom-0 w-px"
            :class="t.major ? 'bg-default' : 'bg-default/30'"
            :style="{ left: `${t.x}px` }"
          />
          <div
            v-for="(r, i) in rows"
            :key="`sep${r.taskId}`"
            class="absolute left-0 right-0 border-b border-default/40"
            :style="{ top: `${(i + 1) * ROW_HEIGHT}px` }"
          />
          <template v-if="horizonX != null">
            <div
              class="absolute top-0 bottom-0 border-l-2 border-dashed border-red-400/70"
              :style="{ left: `${horizonX}px` }"
            />
            <div
              class="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-[10px] font-medium whitespace-nowrap z-[2]"
              :style="{ left: `${horizonX}px` }"
            >
              горизонт
            </div>
          </template>
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-sky-500"
            :style="{ left: `${todayX}px` }"
          />
          <div
            class="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded bg-sky-500 text-white text-[10px] font-medium whitespace-nowrap z-[2]"
            :style="{ left: `${todayX}px` }"
          >
            сегодня
          </div>

          <GanttArrows :segments="segments" :width="laneWidth" :height="laneHeight" />

          <div class="relative z-[1]">
            <GanttRow
              v-for="(r, i) in rows"
              :key="r.taskId"
              :row="r"
              :layout="layout[i]!"
              :row-height="ROW_HEIGHT"
              @open="emit('open-task', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
